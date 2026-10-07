import type { Express } from "express";
import { storageSignedUrl } from "../storage";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/media/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey) {
      const missing = [
        !ENV.supabaseUrl && "SUPABASE_URL",
        !ENV.supabaseServiceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
      ].filter(Boolean);
      console.error(`[StorageProxy] not configured: missing ${missing.join(", ")}`);
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const url = await storageSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      if (err instanceof Error && err.cause) console.error("[StorageProxy] cause:", err.cause);
      res.status(502).send("Storage proxy error");
    }
  });
}
