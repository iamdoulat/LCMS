/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
    // This is to polyfill some node specific modules that are not available in the browser
    // and are dependencies of easyinvoice.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, // You can provide a mock here if needed, or just an empty module
        path: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
