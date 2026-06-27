export type SearchRouteIntent = {
  href: string;
  base: "/films" | "/series" | "/cartoons" | "/anime" | "/latest" | "/popular" | "/collections";
};

const NOISE_WORDS = new Set([
  "смотреть", "посмотреть", "смотри", "смотрим", "watch",
  "онлайн", "online", "бесплатно", "free", "без", "регистрации",
  "в", "во", "на", "с", "со", "для", "каталог", "раздел",
  "hd", "fullhd", "fhd", "uhd", "4k", "1080", "1080p", "720", "720p",
]);

const FRESH_WORDS = new Set(["новинки", "новинка", "новое", "новые", "latest", "new"]);
const POPULAR_WORDS = new Set(["популярное", "популярные", "популярный", "popular"]);
const TOP_WORDS = new Set(["топ", "top", "лучшее", "лучшие", "rating", "рейтинг"]);

const ROUTE_TERMS: Array<{ base: SearchRouteIntent["base"]; terms: Set<string> }> = [
  { base: "/anime", terms: new Set(["аниме", "anime"]) },
  { base: "/cartoons", terms: new Set(["мультфильм", "мультфильмы", "мульт", "мультики", "мультик", "cartoon", "cartoons", "animation"]) },
  { base: "/series", terms: new Set(["сериал", "сериалы", "сериала", "series", "serial", "tv"]) },
  { base: "/films", terms: new Set(["фильм", "фильмы", "фильма", "кино", "movie", "movies", "film", "films"]) },
];

function normalizeRouteSearchText(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildHref(base: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function resolveSearchRedirectPath(query: string): SearchRouteIntent | null {
  const normalized = normalizeRouteSearchText(query);
  if (!normalized) return null;

  const tokens = normalized.split(" ").filter((token) => token && !NOISE_WORDS.has(token));
  if (!tokens.length) return null;

  const year = tokens.find((token) => /^(19|20)\d{2}$/.test(token));
  const wantsFresh = tokens.some((token) => FRESH_WORDS.has(token));
  const wantsPopular = tokens.some((token) => POPULAR_WORDS.has(token));
  const wantsTop = tokens.some((token) => TOP_WORDS.has(token));
  const knownModifier = (token: string) => Boolean(token === year || FRESH_WORDS.has(token) || POPULAR_WORDS.has(token) || TOP_WORDS.has(token));

  for (const route of ROUTE_TERMS) {
    const hasRouteTerm = tokens.some((token) => route.terms.has(token));
    if (!hasRouteTerm) continue;

    const hasOnlyRouteIntent = tokens.every((token) => route.terms.has(token) || knownModifier(token));
    if (!hasOnlyRouteIntent) return null;

    const sort = wantsTop ? "top" : wantsPopular ? "popular" : wantsFresh ? "fresh" : null;
    return { base: route.base, href: buildHref(route.base, { year, sort }) };
  }

  if (tokens.every((token) => FRESH_WORDS.has(token))) return { base: "/latest", href: "/latest" };
  if (tokens.every((token) => POPULAR_WORDS.has(token))) return { base: "/popular", href: "/popular" };
  if (tokens.every((token) => token === "подборки" || token === "подборка" || token === "collections")) {
    return { base: "/collections", href: "/collections" };
  }

  return null;
}
