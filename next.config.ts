import type { NextConfig } from "next";

/**
 * Backend API origin.
 *   - local dev:              unset  -> http://127.0.0.1:3010 (FastAPI on :3010)
 *   - Vercel production:      set BACKEND_URL to the Render service URL, e.g.
 *                             https://forestguard-backend.onrender.com
 */
const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:3010";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /**
   * Proxy the FastAPI mini-service in front of the Next.js app.
   *   - local dev:    forwards to the local Python service on :3010
   *   - production:   forwards to the Render-hosted backend when
   *                   BACKEND_URL is configured
   * The `?XTransformPort=3010` query used by the sandbox gateway is ignored
   * by these destination hosts.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
