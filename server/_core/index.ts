import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerMapsProxy } from "./mapsProxy";
import { storagePut } from "../storage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerMapsProxy(app);
  registerOAuthRoutes(app);

  // Media upload endpoint for community posts (S3 storage)
  app.post("/api/upload-media", async (req, res) => {
    try {
      const files = (req as any).files as { file: any[] } | undefined;
      const file = files?.file?.[0] || (req as any).file;
      if (!file) {
        // Try raw body parsing
        const body = (req as any).body;
        if (body?.file) {
          const buffer = Buffer.from(body.file, "base64");
          const ext = body.filename?.split(".").pop() || "png";
          const key = `community-posts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { url } = await storagePut(key, buffer, body.contentType || "image/png");
          return res.json({ key, url });
        }
        return res.status(400).json({ error: "No file provided" });
      }
      // Multer file
      const f = Array.isArray(file) ? file[0] : file;
      const key = `community-posts/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${f.mimetype.split("/").pop()}`;
      const { url } = await storagePut(key, Buffer.from(f.buffer), f.mimetype);
      res.json({ key, url });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Upload failed", detail: error.message });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
