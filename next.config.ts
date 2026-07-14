import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/vendor/rendex-sdk.min.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    formats: ["image/webp"],
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
