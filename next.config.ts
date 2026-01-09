import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/case-studies/scheduling-time-grid",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
