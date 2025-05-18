
import type {NextConfig} from 'next';
import withPWAInit from "@ducanh2912/next-pwa";

const isDevelopment = process.env.NODE_ENV === 'development';

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: isDevelopment,
  // Exclude PWA generation for development to avoid caching issues
  // You can enable it for testing PWA features in dev if needed by removing 'disable' or setting it to false
});


const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
