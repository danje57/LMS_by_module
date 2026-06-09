import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const MB = 1024 * 1024;
const MAX_UPLOAD = 600 * MB;

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  images: {
    domains: [],
  },
  webpack: (config) => {
    // pdfjs-dist référence le module Node "canvas" — on l'exclut du bundle navigateur
    config.resolve.alias.canvas = false;
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: MAX_UPLOAD,
    },
    // Limite globale pour les Route Handlers (API routes App Router)
    middlewareClientMaxBodySize: MAX_UPLOAD,
  },
};

export default withNextIntl(nextConfig);
