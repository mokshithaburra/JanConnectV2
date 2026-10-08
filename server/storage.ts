// Media lives in a private Supabase Storage bucket. Uploads and signed URLs are
// done server-side with the service role key; clients only ever see
// /media/{key} paths, which redirect to a short-lived signed URL.

import { ENV } from "./_core/env";

const BUCKET = "post-media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function getSupabaseConfig() {
  const url = ENV.supabaseUrl;
  const key = ENV.supabaseServiceRoleKey;

  if (!url || !key) {
    throw new Error(
      "Storage config missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return {
    baseUrl: `${url.replace(/\/+$/, "")}/storage/v1`,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { baseUrl, headers } = getSupabaseConfig();
  const key = appendHashSuffix(normalizeKey(relKey));

  const resp = await fetch(`${baseUrl}/object/${BUCKET}/${encodeKey(key)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": contentType, "x-upsert": "false" },
    body: new Blob([data as any], { type: contentType }),
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage upload failed (${resp.status}): ${msg}`);
  }

  return { key, url: `/media/${key}` };
}

// Returns null when the object does not exist.
export async function storageSignedUrl(relKey: string): Promise<string | null> {
  const { baseUrl, headers } = getSupabaseConfig();
  const key = normalizeKey(relKey);

  const resp = await fetch(`${baseUrl}/object/sign/${BUCKET}/${encodeKey(key)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    // Storage reports a missing object as HTTP 404, or as 400 with statusCode "404" in the body.
    if (resp.status === 404 || /"statusCode"\s*:\s*"404"|not_found/i.test(msg)) return null;
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { signedURL } = (await resp.json()) as { signedURL?: string };
  if (!signedURL) throw new Error("Storage returned an empty signed URL");
  return `${baseUrl}${signedURL}`;
}

export async function storageDelete(relKey: string): Promise<void> {
  const { baseUrl, headers } = getSupabaseConfig();
  const key = normalizeKey(relKey);

  const resp = await fetch(`${baseUrl}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [key] }),
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage delete failed (${resp.status}): ${msg}`);
  }
}
