/** @type {import('next').NextConfig} */
const path = require('path')
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // Alias '@' to the app source root so `@/components/*` resolves to `app/components/*`
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, './app'),
    }
    
    // Suppress bigint-buffer warning
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Failed to load bindings, pure JS will be used/,
    ];
    
    return config;
  },
}

module.exports = nextConfig 