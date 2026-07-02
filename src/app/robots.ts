import type { MetadataRoute } from "next";
import { CANONICAL_SITE_HOST, siteUrl } from "@/lib/seo-links";

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export default function robots(): MetadataRoute.Robots {
  const publicIndexingEnabled = envFlag("PUBLIC_INDEXING_ENABLED", true);
  const emergencyDeindexMode = envFlag("EMERGENCY_DEINDEX_MODE", false);

  if (!publicIndexingEnabled || emergencyDeindexMode) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      host: CANONICAL_SITE_HOST,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/favorites", "/history"],
    },
    sitemap: [
      siteUrl("/sitemap-index.xml"),
      siteUrl("/sitemaps/static.xml"),
      siteUrl("/sitemaps/collections.xml"),
    ],
    host: CANONICAL_SITE_HOST,
  };
}
