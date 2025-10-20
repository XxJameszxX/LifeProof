import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "*.ipfs.w3s.link" as any },
    ],
  },
};

export default nextConfig;


