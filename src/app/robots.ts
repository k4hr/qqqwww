import type { MetadataRoute } from "next";
import { CANONICAL_SITE_HOST, siteUrl } from "@/lib/seo-links";

export default function robots(): MetadataRoute.Robots {
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
