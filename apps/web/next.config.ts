import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/probar", destination: "/testnet", permanent: true },
      { source: "/practica/cooperativa", destination: "/testnet/cooperativa", permanent: true },
      { source: "/practica/importador", destination: "/testnet/importador", permanent: true },
    ];
  },
};

export default nextConfig;
