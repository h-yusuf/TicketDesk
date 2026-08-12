import PocketBase from "pocketbase";

// In dev, VITE_POCKETBASE_URL points at the local PocketBase instance
// (different origin/port than the Vite dev server). In production the web
// app and PocketBase are served from the same domain (Caddy routes
// /api/* and /_/* to PocketBase, everything else to the static build), so
// the env var is left unset and this falls back to the browser's own
// origin — no domain needs to be baked into the build.
export const pb = new PocketBase(
  import.meta.env.VITE_POCKETBASE_URL || window.location.origin
);
