import { z } from "zod";

export const id = z.number().int().positive();
export const offset = z.number().int().min(0).max(10_000).default(0);
export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);
export const dateString = z
  .string()
  .max(64)
  .refine(value => !Number.isNaN(Date.parse(value)), "Invalid date");

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

const isMediaPath = (value: string) => /^\/media\/[\w\-./]+$/.test(value) && !value.includes("..");

// These end up in <a href> / <img src>, so anything but http(s) (e.g.
// javascript:) is rejected. Empty strings are allowed to clear a field.
export const linkUrl = z
  .string()
  .max(500)
  .refine(value => value === "" || isHttpUrl(value), "Must be an http(s) URL");
export const imageUrl = z
  .string()
  .max(2000)
  .refine(value => value === "" || isHttpUrl(value) || isMediaPath(value), "Must be an http(s) URL or /media path");
export const mediaPath = z.string().max(500).refine(isMediaPath, "Must be an uploaded /media path");

// Escape LIKE wildcards so user input matches literally (backslash is Postgres' default escape).
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
