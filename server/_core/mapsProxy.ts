import type { Express, Request, Response } from "express";
import { ENV } from "./env";

/**
 * Same-origin proxy for the Google Maps JavaScript API bootstrap script.
 *
 * The Forge maps proxy at `.../v1/maps/proxy` requires an `Origin` header
 * (CORS check). Browsers do NOT send an Origin header on same-origin script
 * tags (no-cors), so loading the script directly in the client fails with
 * HTTP 403 "origin is required". This route fetches the script server-side,
 * attaches a synthetic Origin header, and streams the bytes back to the
 * browser. Because the request is same-origin from the client's point of
 * view, the response executes normally in a `<script>` tag.
 */

export function registerMapsProxy(app: Express) {
  app.get("/api/maps-proxy/*", async (req: Request, res: Response) => {
    try {
      if (!ENV.forgeApiUrl) {
        return res
          .status(503)
          .type("text/javascript")
          .send("// Google Maps proxy unavailable: missing Forge credentials");
      }

      // Preserve the full path suffix (e.g. "/maps/api/js?key=...")
      const suffix = req.originalUrl.replace(/^\/api\/maps-proxy/, "");
      const url = `${ENV.forgeApiUrl.replace(/\/+$/, "")}/v1/maps/proxy${suffix}`;
      // The Forge maps proxy requires an Origin header (CORS check) but no
      // Authorization header; server-side requests don't send Origin, so we
      // attach one synthetically.
      const upstream = await fetch(url, {
        method: "GET",
        headers: {
          Origin: req.get("origin") || "https://janconnect-qu4xa8u2.manus.space",
          Referer: `${req.get("origin") || "https://janconnect-qu4xa8u2.manus.space"}/`,
        },
      });

      if (!upstream.ok) {
        console.error(`Maps proxy upstream error: ${upstream.status} ${upstream.statusText} for ${suffix}`);
        res.set("Content-Type", "text/javascript; charset=utf-8");
        return res
          .status(upstream.status)
          .send(`// Google Maps proxy upstream error ${upstream.status}`);
      }

      const body = await upstream.text();
      res.set("Content-Type", "text/javascript; charset=utf-8");
      res.set("Cache-Control", "public, max-age=1800");
      res.send(body);
    } catch (error: any) {
      console.error("Maps proxy error:", error);
      res.set("Content-Type", "text/javascript; charset=utf-8");
      res.status(502).send("// Google Maps proxy request failed");
    }
  });
}
