/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'public.easyinvoice.cloud',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is a workaround for a bug in `easyinvoice` that causes issues with webpack.
    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            path: require.resolve("path-browserify")
        };
    }

    return config;
  },
};

export default nextConfig;
