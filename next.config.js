const nextConfig = {
  experimental: {
    serverActions: {}
  },
  compiler: {
    removeConsole: false, // optional
  },
  images: {
    unoptimized: true // disables sharp
  }
};

export default nextConfig;
module.exports = nextConfig;
