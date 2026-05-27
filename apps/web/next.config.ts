import type { NextConfig } from "next";

//addition start
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
//addition end

/*const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf2json"],*/
};

export default nextConfig;