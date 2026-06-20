import type { Movie } from "@prisma/client";

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterateRuToLatin(text: string) {
  return text.toLowerCase().split("").map((letter) => transliteration[letter] ?? letter).join("");
}

export function normalizeSlug(text: string) {
  return transliterateRuToLatin(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

export function normalizeMovieBaseTitle(title: string) {
  return title
    .replace(/\s*[:—–-].*$/u, "")
    .replace(/\s+(?:часть\s*)?\d+\s*$/iu, "")
    .replace(/\s+[ivxlcdm]+\s*$/iu, "")
    .replace(/\s*\(\d{4}\)\s*$/u, "")
    .trim();
}

export function buildMovieBaseSlug(movie: Pick<Movie, "slug">) {
  return movie.slug;
}

export function buildFilmSeoSlug(movie: Pick<Movie, "slug">) {
  return `${buildMovieBaseSlug(movie)}-smotret-online`;
}

export function buildWatchSlug(movie: Pick<Movie, "slug">) {
  return movie.slug;
}

export function buildSimilarSlug(movie: Pick<Movie, "slug">) {
  return movie.slug;
}

export function buildCollectionSlug(baseTitle: string) {
  return `${normalizeSlug(normalizeMovieBaseTitle(baseTitle))}-vse-chasti`;
}

export function buildGenreSlug(genre: string) { return normalizeSlug(genre); }
export function buildCountrySlug(country: string) { return normalizeSlug(country); }
export function buildYearSlug(year: number) { return String(year); }
export function buildQualitySlug(quality: string) { return normalizeSlug(quality); }
export function buildTopicSlug(topic: string) { return normalizeSlug(topic); }

export function movieSlugFromFilmSeoSlug(slug: string) {
  return slug.endsWith("-smotret-online") ? slug.slice(0, -"-smotret-online".length) : null;
}

export function baseSlugFromCollectionSlug(slug: string) {
  return slug.endsWith("-vse-chasti") ? slug.slice(0, -"-vse-chasti".length) : null;
}
