import type { Movie } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type FranchiseOrderEntry = {
  key: string;
  title: string;
  year?: number;
  aliases: string[];
  phase?: string;
};

export type FranchiseConfig = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  searchTerms: string[];
  chronology: FranchiseOrderEntry[];
  releaseOrder: FranchiseOrderEntry[];
  relatedLinks: Array<{ label: string; href: string }>;
};

const marvelChronology: FranchiseOrderEntry[] = [
  { key: "captain-america-first-avenger", title: "Капитан Америка: Первый мститель", year: 2011, phase: "Хронология MCU", aliases: ["капитан америка первый мститель", "captain america the first avenger", "первый мститель"] },
  { key: "captain-marvel", title: "Капитан Марвел", year: 2019, phase: "Хронология MCU", aliases: ["капитан марвел", "captain marvel"] },
  { key: "iron-man", title: "Железный человек", year: 2008, phase: "Фаза 1", aliases: ["железный человек", "iron man"] },
  { key: "iron-man-2", title: "Железный человек 2", year: 2010, phase: "Фаза 1", aliases: ["железный человек 2", "iron man 2"] },
  { key: "incredible-hulk", title: "Невероятный Халк", year: 2008, phase: "Фаза 1", aliases: ["невероятный халк", "the incredible hulk", "hulk"] },
  { key: "thor", title: "Тор", year: 2011, phase: "Фаза 1", aliases: ["тор", "thor"] },
  { key: "avengers", title: "Мстители", year: 2012, phase: "Фаза 1", aliases: ["мстители", "the avengers", "avengers"] },
  { key: "iron-man-3", title: "Железный человек 3", year: 2013, phase: "Фаза 2", aliases: ["железный человек 3", "iron man 3"] },
  { key: "thor-dark-world", title: "Тор 2: Царство тьмы", year: 2013, phase: "Фаза 2", aliases: ["тор 2 царство тьмы", "thor the dark world"] },
  { key: "captain-america-winter-soldier", title: "Первый мститель: Другая война", year: 2014, phase: "Фаза 2", aliases: ["первый мститель другая война", "captain america the winter soldier"] },
  { key: "guardians-galaxy", title: "Стражи Галактики", year: 2014, phase: "Фаза 2", aliases: ["стражи галактики", "guardians of the galaxy"] },
  { key: "guardians-galaxy-2", title: "Стражи Галактики. Часть 2", year: 2017, phase: "Фаза 2", aliases: ["стражи галактики часть 2", "guardians of the galaxy vol 2"] },
  { key: "avengers-age-of-ultron", title: "Мстители: Эра Альтрона", year: 2015, phase: "Фаза 2", aliases: ["мстители эра альтрона", "avengers age of ultron"] },
  { key: "ant-man", title: "Человек-муравей", year: 2015, phase: "Фаза 2", aliases: ["человек муравей", "ant man"] },
  { key: "captain-america-civil-war", title: "Первый мститель: Противостояние", year: 2016, phase: "Фаза 3", aliases: ["первый мститель противостояние", "captain america civil war"] },
  { key: "black-widow", title: "Чёрная вдова", year: 2021, phase: "Фаза 3", aliases: ["черная вдова", "чёрная вдова", "black widow"] },
  { key: "black-panther", title: "Чёрная Пантера", year: 2018, phase: "Фаза 3", aliases: ["черная пантера", "чёрная пантера", "black panther"] },
  { key: "spider-man-homecoming", title: "Человек-паук: Возвращение домой", year: 2017, phase: "Фаза 3", aliases: ["человек паук возвращение домой", "spider man homecoming"] },
  { key: "doctor-strange", title: "Доктор Стрэндж", year: 2016, phase: "Фаза 3", aliases: ["доктор стрэндж", "доктор стрейндж", "doctor strange"] },
  { key: "thor-ragnarok", title: "Тор: Рагнарёк", year: 2017, phase: "Фаза 3", aliases: ["тор рагнарек", "тор рагнарёк", "thor ragnarok"] },
  { key: "ant-man-wasp", title: "Человек-муравей и Оса", year: 2018, phase: "Фаза 3", aliases: ["человек муравей и оса", "ant man and the wasp"] },
  { key: "avengers-infinity-war", title: "Мстители: Война бесконечности", year: 2018, phase: "Фаза 3", aliases: ["мстители война бесконечности", "avengers infinity war"] },
  { key: "avengers-endgame", title: "Мстители: Финал", year: 2019, phase: "Фаза 3", aliases: ["мстители финал", "avengers endgame"] },
  { key: "spider-man-far-from-home", title: "Человек-паук: Вдали от дома", year: 2019, phase: "Фаза 3", aliases: ["человек паук вдали от дома", "spider man far from home"] },
  { key: "shang-chi", title: "Шан-Чи и легенда десяти колец", year: 2021, phase: "Фаза 4", aliases: ["шан чи", "shang chi"] },
  { key: "eternals", title: "Вечные", year: 2021, phase: "Фаза 4", aliases: ["вечные", "eternals"] },
  { key: "spider-man-no-way-home", title: "Человек-паук: Нет пути домой", year: 2021, phase: "Фаза 4", aliases: ["человек паук нет пути домой", "spider man no way home"] },
  { key: "doctor-strange-multiverse", title: "Доктор Стрэндж: В мультивселенной безумия", year: 2022, phase: "Фаза 4", aliases: ["доктор стрэндж в мультивселенной безумия", "doctor strange in the multiverse of madness"] },
  { key: "thor-love-and-thunder", title: "Тор: Любовь и гром", year: 2022, phase: "Фаза 4", aliases: ["тор любовь и гром", "thor love and thunder"] },
  { key: "black-panther-wakanda-forever", title: "Чёрная Пантера: Ваканда навеки", year: 2022, phase: "Фаза 4", aliases: ["черная пантера ваканда навеки", "wakanda forever"] },
  { key: "ant-man-quantumania", title: "Человек-муравей и Оса: Квантомания", year: 2023, phase: "Фаза 5", aliases: ["человек муравей и оса квантомания", "quantumania"] },
  { key: "guardians-galaxy-3", title: "Стражи Галактики. Часть 3", year: 2023, phase: "Фаза 5", aliases: ["стражи галактики часть 3", "guardians of the galaxy vol 3"] },
  { key: "marvels", title: "Марвелы", year: 2023, phase: "Фаза 5", aliases: ["марвелы", "the marvels"] },
  { key: "deadpool-wolverine", title: "Дэдпул и Росомаха", year: 2024, phase: "Фаза 5", aliases: ["дэдпул и росомаха", "deadpool wolverine"] },
];

const marvelReleaseOrder = [...marvelChronology].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

export const franchiseConfigs: Record<string, FranchiseConfig> = {
  "filmy-marvel-po-poryadku": {
    slug: "filmy-marvel-po-poryadku",
    title: "Фильмы Marvel по порядку — REDFILM",
    h1: "Фильмы Marvel по порядку",
    description: "Смотрите фильмы Marvel по порядку: хронология событий, порядок выхода, Мстители, Железный человек, Тор, Стражи Галактики и другие части киновселенной.",
    intro: "Фильмы Marvel удобнее смотреть в понятной последовательности: сначала можно пройти хронологию событий киновселенной, затем сравнить её с порядком выхода. В подборке REDFILM показываются только те фильмы и сериалы Marvel, которые есть в каталоге и доступны для просмотра.",
    searchTerms: ["marvel", "марвел", "мстители", "avengers", "железный человек", "iron man", "тор", "thor", "халк", "hulk", "капитан америка", "captain america", "стражи галактики", "guardians", "человек паук", "spider", "доктор стрэндж", "black panther", "черная пантера", "человек муравей", "ant man", "deadpool", "дэдпул", "росомаха", "wolverine"],
    chronology: marvelChronology,
    releaseOrder: marvelReleaseOrder,
    relatedLinks: [
      { label: "Фильмы про супергероев", href: "/collections/filmy-pro-supergeroev" },
      { label: "Мстители по порядку", href: "/collections/mstiteli-po-poryadku" },
      { label: "Человек-паук по порядку", href: "/collections/chelovek-pauk-po-poryadku" },
      { label: "Фильмы DC", href: "/collections/filmy-dc" },
    ],
  },
};

export function getFranchiseConfig(slug: string) {
  return franchiseConfigs[slug] ?? null;
}

export function buildFranchiseWhere(slug: string): Prisma.MovieWhereInput | null {
  const config = getFranchiseConfig(slug);
  if (!config) return null;
  const terms = config.searchTerms.map((term) => term.trim()).filter(Boolean);
  return {
    OR: terms.flatMap((term) => [
      { titleRu: { contains: term, mode: "insensitive" as const } },
      { titleOriginal: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
    ]),
  };
}

type OrderableMovie = Pick<Movie, "slug" | "titleRu" | "titleOriginal" | "year" | "kpRating" | "imdbRating" | "popularScore" | "topScore">;

function normalize(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replaceAll("ё", "е").replace(/[^a-zа-я0-9]+/gi, " ").replace(/\s+/g, " ").trim();
}

function orderIndex(movie: OrderableMovie, entries: FranchiseOrderEntry[]) {
  const title = `${normalize(movie.titleRu)} ${normalize(movie.titleOriginal)} ${movie.year ?? ""}`;
  let best = Number.POSITIVE_INFINITY;
  entries.forEach((entry, index) => {
    const aliases = [entry.title, ...entry.aliases].map(normalize);
    const matched = aliases.some((alias) => alias.length >= 3 && title.includes(alias));
    if (matched && Math.abs((movie.year ?? entry.year ?? 0) - (entry.year ?? movie.year ?? 0)) <= 2) {
      best = Math.min(best, index);
    }
  });
  return best;
}

export function sortMoviesByFranchiseOrder<T extends OrderableMovie>(slug: string, movies: T[], mode: "chronology" | "release" = "chronology") {
  const config = getFranchiseConfig(slug);
  if (!config) return movies;
  const entries = mode === "release" ? config.releaseOrder : config.chronology;
  return [...movies].sort((a, b) => {
    const ai = orderIndex(a, entries);
    const bi = orderIndex(b, entries);
    if (ai !== bi) return ai - bi;
    return (b.topScore ?? 0) - (a.topScore ?? 0) || (b.popularScore ?? 0) - (a.popularScore ?? 0) || (a.year ?? 9999) - (b.year ?? 9999);
  });
}
