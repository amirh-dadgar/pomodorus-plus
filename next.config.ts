import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev-tools badge at the bottom of the page.
  devIndicators: false,
  // The profile route reads public/banners at runtime (lib/banners-fs.ts), and
  // file tracing only ships files it can see being imported. Without this the
  // directory is missing from the serverless bundle and no banner renders.
  outputFileTracingIncludes: {
    "/u/\\[username\\]": ["./public/banners/**/*"],
  },
};

export default nextConfig;
