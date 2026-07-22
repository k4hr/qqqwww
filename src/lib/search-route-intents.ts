import { parseSearchIntent } from "@/lib/search-v2";

export type SearchRouteIntent = {
  href: string;
  base: "/films" | "/series" | "/cartoons" | "/anime" | "/latest" | "/popular" | "/collections";
};

function buildHref(base: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function resolveSearchRedirectPath(query: string): SearchRouteIntent | null {
  const parsed = parseSearchIntent(query);
  if (!parsed.genericOnly || !parsed.routeIntent) return null;

  const year = parsed.normalizedQuery.split(" ").find((token) => /^(19|20)\d{2}$/.test(token));
  const wantsFresh = /\b(новинки|новинка|новое|новые|latest|new)\b/.test(parsed.normalizedQuery);
  const wantsPopular = /\b(популярное|популярные|популярный|popular)\b/.test(parsed.normalizedQuery);
  const wantsTop = /\b(топ|top|лучшее|лучшие|rating|рейтинг)\b/.test(parsed.normalizedQuery);
  const sort = wantsTop ? "top" : wantsPopular ? "popular" : wantsFresh ? "fresh" : null;

  return {
    base: parsed.routeIntent,
    href: buildHref(parsed.routeIntent, { year, sort }),
  };
}
