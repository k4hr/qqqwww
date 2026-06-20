export type NavigationItem = { label: string; value: string };

export const NAV_YEARS: NavigationItem[] = [
  { label: "2026", value: "2026" }, { label: "2025", value: "2025" },
  { label: "2024", value: "2024" }, { label: "2023", value: "2023" },
  { label: "2022", value: "2022" }, { label: "2021", value: "2021" },
  { label: "2020", value: "2020" }, { label: "2010-е", value: "2010s" },
  { label: "2000-е", value: "2000s" }, { label: "1990-е", value: "1990s" },
];

export const NAV_GENRES: NavigationItem[] = [
  { label: "Боевики", value: "boevik" }, { label: "Комедии", value: "komediya" },
  { label: "Драмы", value: "drama" }, { label: "Ужасы", value: "uzhasy" },
  { label: "Фантастика", value: "fantastika" }, { label: "Триллеры", value: "triller" },
  { label: "Детективы", value: "detektiv" }, { label: "Криминал", value: "kriminal" },
  { label: "Мелодрамы", value: "melodrama" }, { label: "Приключения", value: "priklyucheniya" },
  { label: "Семейные", value: "semeynyy" }, { label: "Военные", value: "voennyy" },
  { label: "Исторические", value: "istoriya" }, { label: "Биографии", value: "biografiya" },
];

export const NAV_COUNTRIES: NavigationItem[] = [
  { label: "США", value: "ssha" }, { label: "Россия", value: "rossiya" },
  { label: "Великобритания", value: "velikobritaniya" }, { label: "Франция", value: "frantsiya" },
  { label: "Германия", value: "germaniya" }, { label: "Испания", value: "ispaniya" },
  { label: "Италия", value: "italiya" }, { label: "Китай", value: "kitay" },
  { label: "Япония", value: "yaponiya" }, { label: "Индия", value: "indiya" },
  { label: "Южная Корея", value: "yuzhnaya-koreya" },
];

export const NAV_TOPICS = [
  { label: "ТОП 100", href: "/top" },
  { label: "Новинки 2026", href: "/movies?year=2026&sort=new" },
  { label: "Популярные", href: "/top" },
  { label: "FullHD", href: "/quality/fullhd" },
  { label: "Супергерои", href: "/collections/supergeroi" },
  { label: "Фантастика", href: "/genre/fantastika" },
  { label: "Marvel", href: "/collections/marvel" },
  { label: "Комиксы", href: "/collections/komiksy" },
] as const;

export function catalogHref(base: "/movies" | "/series", key?: "year" | "genre" | "country" | "sort", value?: string) {
  if (!key || !value) return base;
  return `${base}?${new URLSearchParams({ [key]: value }).toString()}`;
}
