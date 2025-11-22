/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gainesvillecarpetsplus.com",
      },
    ],
  },
};

export default nextConfig;
