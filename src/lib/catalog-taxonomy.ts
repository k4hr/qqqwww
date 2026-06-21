import type { Prisma } from "@prisma/client";

export type TaxonomyItem = {
  slug: string;
  label: string;
  aliases: string[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export const CATALOG_GENRES: TaxonomyItem[] = [
  { slug: "multfilmy", label: "Мультфильмы", aliases: ["мультфильм", "мультфильмы", "мультсериал", "мультсериалы", "анимация", "animation", "animated", "cartoon"] },
  { slug: "anime", label: "Аниме", aliases: ["аниме", "anime", "manga", "манга"] },
  { slug: "boeviki", label: "Боевики", aliases: ["боевик", "боевики", "action", "ekshen"] },
  { slug: "komedii", label: "Комедии", aliases: ["комедия", "комедии", "comedy"] },
  { slug: "dramy", label: "Драмы", aliases: ["драма", "драмы", "drama"] },
  { slug: "uzhasy", label: "Ужасы", aliases: ["ужасы", "ужас", "horror"] },
  { slug: "fantastika", label: "Фантастика", aliases: ["фантастика", "sci-fi", "science fiction", "fantastic"] },
  { slug: "trillery", label: "Триллеры", aliases: ["триллер", "триллеры", "thriller"] },
  { slug: "detektivy", label: "Детективы", aliases: ["детектив", "детективы", "detective"] },
  { slug: "kriminal", label: "Криминал", aliases: ["криминал", "crime", "criminal"] },
  { slug: "melodramy", label: "Мелодрамы", aliases: ["мелодрама", "мелодрамы", "romance"] },
  { slug: "priklyucheniya", label: "Приключения", aliases: ["приключения", "приключение", "adventure"] },
  { slug: "semeynye", label: "Семейные", aliases: ["семейный", "семейные", "family"] },
  { slug: "fentezi", label: "Фэнтези", aliases: ["фэнтези", "fantasy"] },
  { slug: "voennye", label: "Военные", aliases: ["военный", "военные", "war"] },
  { slug: "istoricheskie", label: "Исторические", aliases: ["история", "исторический", "history"] },
  { slug: "biografii", label: "Биографии", aliases: ["биография", "биографический", "biography"] },
];

export const CATALOG_COUNTRIES: TaxonomyItem[] = [
  { slug: "usa", label: "США", aliases: ["сша", "united states", "usa", "america", "америка"] },
  { slug: "russia", label: "Россия", aliases: ["россия", "russia"] },
  { slug: "uk", label: "Великобритания", aliases: ["великобритания", "uk", "great britain", "united kingdom", "англия"] },
  { slug: "france", label: "Франция", aliases: ["франция", "france"] },
  { slug: "germany", label: "Германия", aliases: ["германия", "germany", "deutschland"] },
  { slug: "spain", label: "Испания", aliases: ["испания", "spain"] },
  { slug: "italy", label: "Италия", aliases: ["италия", "italy"] },
  { slug: "china", label: "Китай", aliases: ["китай", "china"] },
  { slug: "japan", label: "Япония", aliases: ["япония", "japan"] },
  { slug: "india", label: "Индия", aliases: ["индия", "india"] },
  { slug: "korea", label: "Южная Корея", aliases: ["южная корея", "корея", "south korea", "korea"] },
];

const LEGACY_GENRE_SLUGS: Record<string, string> = {
  multfilm: "multfilmy",
  multfilmy: "multfilmy",
  multiki: "multfilmy",
  anime: "anime",
  boevik: "boeviki",
  komediya: "komedii",
  drama: "dramy",
  triller: "trillery",
  detektiv: "detektivy",
  melodrama: "melodramy",
  semeynyy: "semeynye",
  voennyy: "voennye",
  istoriya: "istoricheskie",
  biografiya: "biografii",
};

const LEGACY_COUNTRY_SLUGS: Record<string, string> = {
  ssha: "usa",
  rossiya: "russia",
  velikobritaniya: "uk",
  frantsiya: "france",
  germaniya: "germany",
  ispaniya: "spain",
  italiya: "italy",
  kitay: "china",
  yaponiya: "japan",
  indiya: "india",
  "yuzhnaya-koreya": "korea",
  "south-korea": "korea",
};

function findBySlugOrAlias(items: TaxonomyItem[], slug?: string | null, legacy?: Record<string, string>) {
  if (!slug) return null;
  const normalized = normalize(slug);
  const canonical = legacy?.[normalized] ?? normalized;
  return items.find((item) => item.slug === canonical || item.aliases.some((alias) => normalize(alias) === canonical)) ?? null;
}

export function getGenreTaxonomy(slug?: string | null) {
  return findBySlugOrAlias(CATALOG_GENRES, slug, LEGACY_GENRE_SLUGS);
}

export function getCountryTaxonomy(slug?: string | null) {
  return findBySlugOrAlias(CATALOG_COUNTRIES, slug, LEGACY_COUNTRY_SLUGS);
}

export function genreWhere(slug?: string | null): Prisma.MovieWhereInput {
  const item = getGenreTaxonomy(slug);
  if (!item) return {};
  const names = [item.slug, item.label, ...item.aliases];
  return {
    OR: names.flatMap((value) => [
      { genres: { some: { genre: { slug: { equals: value, mode: "insensitive" } } } } },
      { genres: { some: { genre: { name: { contains: value, mode: "insensitive" } } } } },
    ]),
  };
}

export function countryWhere(slug?: string | null): Prisma.MovieWhereInput {
  const item = getCountryTaxonomy(slug);
  if (!item) return {};
  return {
    OR: item.aliases.concat(item.label, item.slug).map((value) => ({ country: { contains: value, mode: "insensitive" as const } })),
  };
}

export function genreLabel(slug?: string | null) {
  return getGenreTaxonomy(slug)?.label ?? slug ?? "жанр";
}

export function countryLabel(slug?: string | null) {
  return getCountryTaxonomy(slug)?.label ?? slug ?? "страна";
}
