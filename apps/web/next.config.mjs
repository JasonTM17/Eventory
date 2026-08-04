/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@eventory/contracts', '@eventory/ui'],
  devIndicators: false,
};

export default nextConfig;
