/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server-side packages that shouldn't be bundled
  serverExternalPackages: ['ioredis', 'bcryptjs', 'jsonwebtoken', 'geoip-lite', 'uuid', 'resend'],

  // Transpile Three.js packages
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Environment variables available to the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'TrafficShield',
    NEXT_PUBLIC_APP_VERSION: '4.0.0',
  },
};

module.exports = nextConfig;
