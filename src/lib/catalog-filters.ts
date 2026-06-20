import type { Movie, Prisma } from "@prisma/client";

export const LOW_PRIORITY_COUNTRIES = [
  "Китай",
  "Япония",
  "Индия",
  "Южная Корея",
  "Таиланд",
  "Индонезия",
  "Филиппины",
  "China",
  "Japan",
  "India",
  "South Korea",
  "Thailand",
  "Indonesia",
  "Philippines",
] as const;

export const COUNTRY_FILTER_OPTIONS = [
  { value: "main", label: "Основной каталог" },
  { value: "all", label: "Все страны" },
  { value: "usa", label: "США" },
  { value: "uk", label: "Великобритания" },
  { value: "france", label: "Франция" },
  { value: "germany", label: "Германия" },
  { value: "spain", label: "Испания" },
  { value: "italy", label: "Италия" },
  { value: "russia", label: "Россия" },
  { value: "china", label: "Китай" },
  { value: "japan", label: "Япония" },
  { value: "india", label: "Индия" },
  { value: "south-korea", label: "Южная Корея" },
  { value: "other", label: "Другие" },
] as const;

export type CatalogCountry = (typeof COUNTRY_FILTER_OPTIONS)[number]["value"];

const countryAliases: Record<Exclude<CatalogCountry, "main" | "all" | "other">, readonly string[]> = {
  usa: ["США", "Соединенные Штаты", "Соединённые Штаты", "United States", "USA"],
  uk: ["Великобритания", "United Kingdom", "Great Britain"],
  france: ["Франция", "France"],
  germany: ["Германия", "Germany"],
  spain: ["Испания", "Spain"],
  italy: ["Италия", "Italy"],
  russia: ["Россия", "Russia", "Russian Federation"],
  china: ["Китай", "China"],
  japan: ["Япония", "Japan"],
  india: ["Индия", "India"],
  "south-korea": ["Южная Корея", "Корея Южная", "South Korea", "Korea, South", "Republic of Korea"],
};

const normalizedLowPriorityCountries = LOW_PRIORITY_COUNTRIES.map(normalizeCountryText);
const namedCountryAliases = Object.values(countryAliases).flat();

function normalizeCountryText(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function excludesAliases(aliases: readonly string[]): Prisma.MovieWhereInput[] {
  return aliases.map((alias) => ({
    country: { not: { contains: alias, mode: "insensitive" } },
  }));
}

function containsAliases(aliases: readonly string[]): Prisma.MovieWhereInput {
  return {
    OR: aliases.map((alias) => ({
      country: { contains: alias, mode: "insensitive" },
    })),
  };
}

export function isLowPriorityCountry(countryText?: string | null) {
  if (!countryText?.trim()) return false;
  const normalized = normalizeCountryText(countryText);
  return normalizedLowPriorityCountries.some((country) => normalized.includes(country));
}

export function extractCountries(countryText?: string | null) {
  if (!countryText?.trim()) return [];
  return Array.from(new Set(
    countryText
      .split(/[,;/|]+/)
      .map((country) => country.trim())
      .filter(Boolean),
  ));
}

export function evaluateMovieCatalogVisibility(movie: Pick<Movie, "country"> | { country?: string | null }) {
  const countryText = movie.country?.trim() ?? "";
  const normalized = normalizeCountryText(countryText);
  const blockedCountry = LOW_PRIORITY_COUNTRIES.find((country) => normalized.includes(normalizeCountryText(country)));

  return {
    isCatalogAllowed: !blockedCountry,
    catalogBlockReason: blockedCountry ? `country: ${blockedCountry}` : null,
    normalizedCountries: extractCountries(countryText),
    catalogCheckedAt: new Date(),
  };
}

export function normalizeCatalogCountry(value?: string | null): CatalogCountry {
  const aliases: Record<string, CatalogCountry> = {
    ssha: "usa", velikobritaniya: "uk", frantsiya: "france", germaniya: "germany",
    ispaniya: "spain", italiya: "italy", rossiya: "russia", kitay: "china",
    yaponiya: "japan", indiya: "india", "yuzhnaya-koreya": "south-korea",
  };
  const normalized = value ? aliases[value] ?? value : value;
  return COUNTRY_FILTER_OPTIONS.some((option) => option.value === normalized)
    ? normalized as CatalogCountry
    : "main";
}

export function buildDefaultCatalogCountryWhere(): Prisma.MovieWhereInput {
  return { isCatalogAllowed: true };
}

export function buildCountryFilterWhere(country?: string | null): Prisma.MovieWhereInput {
  const normalized = normalizeCatalogCountry(country);
  if (normalized === "all") return {};
  if (normalized === "main") return buildDefaultCatalogCountryWhere();
  if (normalized === "other") {
    return {
      AND: [
        { country: { not: null } },
        { country: { not: "" } },
        ...excludesAliases(namedCountryAliases),
      ],
    };
  }
  return containsAliases(countryAliases[normalized]);
}
