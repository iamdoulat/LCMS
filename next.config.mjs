
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'public.easyinvoice.cloud',
        port: '',
        pathname: '**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // This is needed to support `easyinvoice` which has some node-specific dependencies.
    // By providing a fallback, we tell webpack to use a browser-compatible version.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Use the browser-compatible version of the 'path' module.
      path: 'path-browserify',
    };
    
    // This rule is to handle a specific '.node' file issue within a dependency of easyinvoice.
    config.module.rules.push({
      test: /\.node$/,
      use: 'raw-loader',
    });

    return config;
  },
};

export default nextConfig;
