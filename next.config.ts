import type { NextConfig } from "next";

const MB = 1024 * 1024;
const MAX_UPLOAD = 600 * MB; // 600 MB en octets

const nextConfig: NextConfig = {
  images: {
    domains: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: MAX_UPLOAD,
    },
    // Limite globale pour les Route Handlers (API routes App Router)
    middlewareClientMaxBodySize: MAX_UPLOAD,
  },
};

export default nextConfig;
