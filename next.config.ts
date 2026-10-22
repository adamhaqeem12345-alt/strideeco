import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An isolated directory lets local verification avoid existing build state.
  distDir: process.env.STRIDEECO_BUILD_DIR || '.next',
};

export default nextConfig;
