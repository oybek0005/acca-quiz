import type { NextConfig } from "next";

/**
 * The app is a client-only SPA (all state is localStorage / the user's own
 * Firebase project). We ship it as a static export so it can be served by any
 * static host (nginx, Netlify, GitHub Pages, ...).
 *
 * Security headers (CSP etc.) can't be set here in export mode — apply them at
 * the web server. See `deploy/nginx.conf`.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
