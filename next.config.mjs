/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
      },
       {
        protocol: 'https',
        hostname: 'public.easyinvoice.cloud',
        port: '',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is the standard way to handle canvas with Next.js for server-side rendering
    if (isServer) {
      config.externals.push('canvas');
    }
    
    // This was the incorrect polyfill that was causing issues. It's now removed.
    // config.resolve.fallback = {
    //   ...config.resolve.fallback,
    //   "path-browserify": false,
    //   "fs": false,
    //   "os": false,
    //   "path": false,
    //   "canvas": false,
    // };

    return config;
  },
};

export default nextConfig;
