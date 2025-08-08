/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Suppress bigint-buffer warning
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Failed to load bindings, pure JS will be used/,
    ];
    
    return config;
  },
}

module.exports = nextConfig 