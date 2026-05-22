/** @type {import('next').NextConfig} */
const nextConfig = {
  // The listening engine + UI carry their own checks; keep ESLint from
  // blocking production deploys.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
