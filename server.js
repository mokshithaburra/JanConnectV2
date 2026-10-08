// Vercel's Express preset finds the app by file location (server.js at the repo
// root). The app itself is bundled into dist/index.js by `pnpm build`, which
// resolves the @shared/* path aliases that Vercel's own loader would not.
import express from "express"; // Vercel detects Express apps by this import; the app itself comes from dist/index.js
export { default } from "./dist/index.js";
