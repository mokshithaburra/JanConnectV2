import "dotenv/config";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@shared/const";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { storagePut } from "../storage";
import { closeDb, pingDb } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { assertEnv, ENV } from "./env";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";

// Trust the file's magic bytes, not the client-supplied content type.
function detectImageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString("latin1"))) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function limiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
}

// CSRF guard for cookie-authenticated POSTs: requiring JSON forces a CORS
// preflight for cross-site requests, and a present Origin must match our host.
const requireSameOriginJson: RequestHandler = (req, res, next) => {
  if (req.method !== "POST") return next();

  const contentType = (req.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }

  const origin = req.get("origin");
  if (origin) {
    const expectedHost = (ENV.isProduction && req.get("x-forwarded-host")) || req.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (!originHost || originHost !== expectedHost) {
      res.status(403).json({ error: "Cross-origin request rejected" });
      return;
    }
  }

  next();
};

function contentSecurityPolicy() {
  // Google Maps needs its script/connect hosts, blob workers and 'unsafe-eval'
  // (per Google's allowlist CSP guidance). img-src allows any https host so
  // /media redirects to Supabase and admin-provided logos keep working.
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "blob:", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "data:", "blob:", "https://*.googleapis.com", "https://*.google.com", "https://*.gstatic.com"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["https://*.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  };
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function createApp() {
  assertEnv();

  const app = express();

  // One trusted hop: our load balancer, or Vercel's edge, which overwrites
  // X-Forwarded-For with the client IP, so req.ip (and rate limiting) sees the real client.
  if (ENV.isProduction || process.env.VERCEL) app.set("trust proxy", 1);
  // CSP is production-only: the Vite dev server relies on inline scripts and HMR.
  app.use(helmet({ contentSecurityPolicy: ENV.isProduction ? contentSecurityPolicy() : false }));

  app.get("/healthz", async (_req, res) => {
    try {
      await pingDb();
      res.json({ status: "ok" });
    } catch (error) {
      console.error("[Health] Database check failed:", error);
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.use("/api/oauth/callback", limiter(15 * 60_000, 20));
  app.use("/api/upload-media", limiter(15 * 60_000, 30), requireSameOriginJson);
  app.use("/api/trpc", limiter(60_000, 300), requireSameOriginJson);

  // A 3 MB file is ~4.2 MB as base64 JSON (Vercel rejects bodies over 4.5 MB); everything else is small.
  app.use("/api/upload-media", express.json({ limit: "4.5mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Media upload endpoint for community posts. Body: { file: base64, filename, contentType }.
  app.post("/api/upload-media", async (req, res) => {
    try {
      try {
        await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Sign in to upload media" });
      }

      const body = req.body;
      if (typeof body?.file !== "string" || !body.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const buffer = Buffer.from(body.file, "base64");
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: `File must be ${MAX_UPLOAD_MB} MB or smaller` });
      }
      const type = detectImageType(buffer);
      if (!type) {
        return res.status(415).json({ error: "Only JPEG, PNG, WebP and GIF images are allowed" });
      }
      const key = `community-posts/${randomUUID()}.${type.ext}`;
      const { url } = await storagePut(key, buffer, type.mime);
      res.json({ key, url });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed", ...(ENV.isProduction ? {} : { detail: error.message }) });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error }) {
        console.error(`[tRPC] ${path ?? "<no path>"} failed:`, error.message);
        if (error.cause) console.error("[tRPC] cause:", error.cause);
      },
    })
  );

  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) console.error("[Express] Unhandled error:", err);
  const message = status >= 500 && ENV.isProduction ? "Internal server error" : err?.message ?? "Request failed";
  res.status(status).json({ error: message });
};

// Local `pnpm dev` / `pnpm start`: serve the client, listen, and shut down cleanly.
async function startServer(app: express.Express) {
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  app.use(errorHandler);

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production the proxy expects PORT exactly; only hunt for a free port in development.
  const port = ENV.isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received, shutting down`);
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      closeDb()
        .catch(error => console.error("[Server] Failed to close database pool:", error))
        .finally(() => process.exit(0));
    });
    // Keep-alive and HMR sockets would otherwise hold close() open.
    if (ENV.isProduction) server.closeIdleConnections();
    else server.closeAllConnections();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

const app = createApp();

// On Vercel the app runs as a single function: Vercel serves public/ from its CDN
// and owns the HTTP server, so there is nothing to listen on or shut down.
if (process.env.VERCEL) {
  app.use(errorHandler);
} else {
  startServer(app).catch(error => {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  });
}

export default app;
