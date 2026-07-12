import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1440],
    imageSizes: [96, 128, 192, 256, 320, 384],
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "avatars.mds.yandex.net" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "image.openmoviedb.com" },
      { protocol: "https", hostname: "st.kp.yandex.net" },
      { protocol: "https", hostname: "kinopoiskapiunofficial.tech" }
    ]
  }
};

export default nextConfig;
