const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  },
  eslint: {
    // Don’t fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don’t block build on TS type errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
