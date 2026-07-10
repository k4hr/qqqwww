export const PUBLIC_HTML_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";
export const PUBLIC_SITEMAP_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
export const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

const PRIVATE_PREFIXES = [
  "/admin",
  "/api",
  "/partner",
  "/tg",
  "/telegram",
] as const;

const SITEMAP_PREFIXES = [
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemaps",
] as const;

export function isPrivateCachePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function publicCacheControlForPath(pathname: string) {
  if (SITEMAP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return PUBLIC_SITEMAP_CACHE_CONTROL;
  }
  return PUBLIC_HTML_CACHE_CONTROL;
}
