import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REDFILM",
    short_name: "REDFILM",
    description: "Р¤РёР»СЊРјС‹ Рё СЃРµСЂРёР°Р»С‹ РѕРЅР»Р°Р№РЅ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070708",
    theme_color: "#070708",
    icons: [
      { src: "/favicon-120.png?v=6", sizes: "120x120", type: "image/png" },
      { src: "/icon.png?v=6", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png?v=6", sizes: "180x180", type: "image/png" },
    ],
  };
}

