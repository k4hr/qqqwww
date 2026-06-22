export const VIBIX_CATEGORY_IDS = {
  anime: 18,
  cartoon: 14,
  adultCartoon: 21,
  dorama: 280,
  lakorn: 3,
  mainstream: 2,
} as const;

export const VIBIX_GENRE_IDS = {
  anime: 25,
  animation: 3,
  action: 13,
  comedy: 5,
  drama: 8,
  thriller: 11,
  horror: 10,
  fantasy: 12,
  sciFi: 34,
  adventure: 6,
  documentary: 2,
  short: 4,
  family: 7,
  romance: 22,
  crime: 14,
  detective: 19,
} as const;

export const VIBIX_TAG_IDS = {
  lgbt: 1,
  adult18: 2,
  new: 3,
  popular: 6,
  serial: 10,
  dorama: 12,
  action: 13,
  adult: 14,
  short: 15,
  horror: 17,
} as const;

export const VIBIX_COUNTRY_IDS = {
  usa: 3,
  russia: 15,
  uk: 6,
  france: 7,
  germany: 2,
  japan: 9,
  china: 19,
  southKorea: 4,
  india: 8,
} as const;

export const VIBIX_AUDIT_FILTERS = [
  { key: "movie_all", label: "Vibix: все фильмы", sourceType: "movie" as const },
  { key: "serial_all", label: "Vibix: все сериалы", sourceType: "serial" as const },
  { key: "movie_anime_category", label: "Vibix: аниме среди movie", sourceType: "movie" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.anime },
  { key: "serial_anime_category", label: "Vibix: аниме среди serial", sourceType: "serial" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.anime },
  { key: "movie_cartoon_category", label: "Vibix: мультфильмы среди movie", sourceType: "movie" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.cartoon },
  { key: "serial_cartoon_category", label: "Vibix: мультфильмы среди serial", sourceType: "serial" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.cartoon },
  { key: "movie_dorama_category", label: "Vibix: дорамы среди movie", sourceType: "movie" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.dorama },
  { key: "serial_dorama_category", label: "Vibix: дорамы среди serial", sourceType: "serial" as const, filterKind: "category", filterId: VIBIX_CATEGORY_IDS.dorama },
  { key: "movie_anime_genre", label: "Vibix: жанр аниме среди movie", sourceType: "movie" as const, filterKind: "genre", filterId: VIBIX_GENRE_IDS.anime },
  { key: "serial_anime_genre", label: "Vibix: жанр аниме среди serial", sourceType: "serial" as const, filterKind: "genre", filterId: VIBIX_GENRE_IDS.anime },
  { key: "movie_animation_genre", label: "Vibix: жанр мультфильм среди movie", sourceType: "movie" as const, filterKind: "genre", filterId: VIBIX_GENRE_IDS.animation },
  { key: "serial_animation_genre", label: "Vibix: жанр мультфильм среди serial", sourceType: "serial" as const, filterKind: "genre", filterId: VIBIX_GENRE_IDS.animation },
] as const;

export function vibixFilterLabel(filterKind?: string | null, filterId?: number | null) {
  if (!filterKind || !filterId) return "всё";
  const lookup = {
    category: Object.entries(VIBIX_CATEGORY_IDS),
    genre: Object.entries(VIBIX_GENRE_IDS),
    tag: Object.entries(VIBIX_TAG_IDS),
    country: Object.entries(VIBIX_COUNTRY_IDS),
  }[filterKind] as [string, number][] | undefined;
  const found = lookup?.find(([, value]) => value === filterId)?.[0];
  return found ? `${filterKind}:${found}` : `${filterKind}:${filterId}`;
}
