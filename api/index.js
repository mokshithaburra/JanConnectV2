// Vercel Function for the Express app. vercel.json rewrites /api/*, /media/* and
// /healthz here and also passes the original path as ?__path=..., so Express sees
// /api/trpc/..., /media/... or /healthz whether the runtime hands us the original
// URL or the rewritten /api/index one. The app is bundled into dist/index.js by
// `pnpm build` (esbuild resolves the @shared/* path aliases).
import app from "../dist/index.js";

export default function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const originalPath = url.searchParams.get("__path");
  if (originalPath !== null) {
    url.searchParams.delete("__path");
    if (url.pathname === "/api/index" || url.pathname === "/api") url.pathname = originalPath;
    req.url = url.pathname + url.search;
  }
  return app(req, res);
}
