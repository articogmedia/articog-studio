/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['studio', 'ai-agent', 'workflow-builder', 'design-agent'],
  env: {
    BYTEPLUS_SEEDREAM_MODEL: process.env.BYTEPLUS_SEEDREAM_MODEL || 'dola-seedream-5-0-pro-260628',
    BYTEPLUS_SEEDANCE_MODEL: process.env.BYTEPLUS_SEEDANCE_MODEL || 'seedance-1-0-pro-250528',
  },
};

export default nextConfig;
