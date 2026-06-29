import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
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
