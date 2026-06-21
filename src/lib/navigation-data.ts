export type NavigationItem = { label: string; value: string };

export const NAV_YEARS: NavigationItem[] = [
  { label: "2026", value: "2026" }, { label: "2025", value: "2025" },
  { label: "2024", value: "2024" }, { label: "2023", value: "2023" },
  { label: "2022", value: "2022" }, { label: "2021", value: "2021" },
  { label: "2020", value: "2020" }, { label: "2010-е", value: "2010s" },
  { label: "2000-е", value: "2000s" }, { label: "1990-е", value: "1990s" },
];

export const NAV_GENRES: NavigationItem[] = [
  { label: "Боевики", value: "boeviki" }, { label: "Комедии", value: "komedii" },
  { label: "Драмы", value: "dramy" }, { label: "Ужасы", value: "uzhasy" },
  { label: "Фантастика", value: "fantastika" }, { label: "Триллеры", value: "trillery" },
  { label: "Детективы", value: "detektivy" }, { label: "Криминал", value: "kriminal" },
  { label: "Мелодрамы", value: "melodramy" }, { label: "Приключения", value: "priklyucheniya" },
  { label: "Семейные", value: "semeynye" }, { label: "Фэнтези", value: "fentezi" },
  { label: "Военные", value: "voennye" }, { label: "Исторические", value: "istoricheskie" },
  { label: "Биографии", value: "biografii" },
];

export const NAV_COUNTRIES: NavigationItem[] = [
  { label: "США", value: "usa" }, { label: "Россия", value: "russia" },
  { label: "Великобритания", value: "uk" }, { label: "Франция", value: "france" },
  { label: "Германия", value: "germany" }, { label: "Испания", value: "spain" },
  { label: "Италия", value: "italy" }, { label: "Китай", value: "china" },
  { label: "Япония", value: "japan" }, { label: "Индия", value: "india" },
  { label: "Южная Корея", value: "korea" },
];

export const NAV_TOPICS = [
  { label: "ТОП 100", href: "/top-100" },
  { label: "Новинки 2026", href: "/films/year/2026" },
  { label: "Популярные", href: "/popular" },
  { label: "FullHD", href: "/quality/fullhd" },
  { label: "Супергерои", href: "/collections/supergeroi" },
  { label: "Фантастика", href: "/films/genre/fantastika" },
  { label: "Marvel", href: "/collections/marvel" },
  { label: "Комиксы", href: "/collections/komiksy" },
] as const;

export type CatalogBase = "/films" | "/movies" | "/series";

export function catalogHref(base: CatalogBase, key?: "year" | "genre" | "country" | "sort", value?: string) {
  if (!key || !value) return base;
  if (key === "year" && /^\d{4}$/.test(value)) return `${base}/year/${value}`;
  if (key === "genre") return `${base}/genre/${value}`;
  if (key === "country") return `${base}/country/${value}`;
  if (key === "sort" && value === "popular") return `${base}/popular`;
  if (key === "sort" && (value === "rating" || value === "top")) return `${base}/top-100`;
  if (key === "sort" && value === "new") return `${base}/year/${new Date().getFullYear()}`;
  return `${base}?${new URLSearchParams({ [key]: value }).toString()}`;
}
