import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo-links";


export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  // Next metadata sitemap returns <urlset>, not <sitemapindex>. The real sitemap
  // index lives at /sitemap-index.xml and robots.txt points to it. This file stays
  // as a lightweight compatibility entry point for crawlers that open /sitemap.xml.
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/sitemap-index.xml"), changeFrequency: "daily", priority: .9 },
    { url: siteUrl("/sitemaps/static.xml"), changeFrequency: "daily", priority: .8 },
    { url: siteUrl("/sitemaps/collections.xml"), changeFrequency: "weekly", priority: .7 },
  ];
}
