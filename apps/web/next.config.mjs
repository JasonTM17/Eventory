/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@eventory/contracts', '@eventory/ui'],
};

export default nextConfig;
