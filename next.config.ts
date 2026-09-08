import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /**
   * Local-dev convenience: proxy API calls to the FastAPI mini-service on
   * :3010.  On the sandbox preview domain the gateway handles this via the
   * ?XTransformPort=3010 param, so the rewrite is only exercised when the
   * app is opened directly on localhost:3000.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3010/api/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:3010/health",
      },
    ];
  },
};

export default nextConfig;
