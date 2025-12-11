/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
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
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is to solve a bug in easyinvoice where it requires a browser polyfill for path
    // that is not automatically provided by Next.js.
    // See: https://webpack.js.org/configuration/resolve/#resolvefallback
    config.resolve.fallback = {
      ...config.resolve.fallback,
      path: false,
    };
    return config;
  },
};

export default nextConfig;
