import type { NextConfig } from "next";

// cacheComponents stays off: it breaks the R3F canvas on client navigation (pmndrs/react-three-fiber#3595).
const nextConfig: NextConfig = {
  // dev-only: lets the ngrok TCP tunnel load dev assets/HMR (hostname only; port is ignored by Next)
  allowedDevOrigins: ["4.tcp.eu.ngrok.io"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/regions/:path*",
        // filenames are not content-hashed, so no `immutable`: cache an hour, revalidate in the background
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
