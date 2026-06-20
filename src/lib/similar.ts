import type { Movie, MovieCast, MovieGenre, Person, Genre, ContentType } from "@prisma/client";
import { normalizeMovieBaseTitle } from "@/lib/seo-slugs";

type MovieWithRelations = Movie & {
  genres: Array<MovieGenre & { genre: Genre }>;
  cast: Array<MovieCast & { person: Person }>;
};

export type SimilarMovieResult = MovieWithRelations & {
  similarityScore: number;
  similarityReasons: string[];
};

const themeKeywordGroups = [
  {
    name: "месть и личное правосудие",
    words: ["месть", "отомст", "правосуд", "справедлив", "наказ", "возмезд", "расплат"],
  },
  {
    name: "преступления и расследования",
    words: ["преступ", "расслед", "убий", "детектив", "маньяк", "похищ", "полици", "следов"],
  },
  {
    name: "суд и закон",
    words: ["суд", "адвокат", "прокур", "закон", "тюрьм", "присяж", "обвин"],
  },
  {
    name: "супергерои и спасение мира",
    words: ["супергер", "герой", "спас", "злод", "сверх", "мутант", "паук", "марвел"],
  },
  {
    name: "космос и фантастика",
    words: ["космос", "планет", "галакт", "будущ", "робот", "иноплан", "корабл", "цивилизац"],
  },
  {
    name: "магия и фэнтези",
    words: ["маг", "волшеб", "дракон", "королев", "прокля", "заклин", "фэнтез"],
  },
  {
    name: "любовь и отношения",
    words: ["любов", "роман", "отношен", "свадьб", "чувств", "пара", "расстав"],
  },
  {
    name: "семья и дети",
    words: ["семь", "ребен", "дети", "родител", "мама", "папа", "дочь", "сын"],
  },
  {
    name: "война и выживание",
    words: ["войн", "солдат", "выжив", "арм", "битв", "фронт", "захват"],
  },
  {
    name: "страх и мистика",
    words: ["ужас", "призрак", "демон", "мист", "кошмар", "прокля", "страш"],
  },
];

const stopWords = new Set([
  "фильм", "сериал", "герой", "герои", "жизнь", "история", "однажды", "становится", "который", "которая",
  "которые", "после", "перед", "свой", "свои", "своей", "один", "одна", "чтобы", "когда", "вместе",
  "очень", "новый", "новая", "каждый", "может", "будет", "только", "снова", "самый", "самая",
]);

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/ё/g, "е");
}

function tokenize(value: string | null | undefined) {
  return Array.from(new Set(
    normalizeText(value)
      .replace(/[^a-zа-я0-9\s-]/gi, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !stopWords.has(word)),
  ));
}

function genreSet(movie: MovieWithRelations) {
  return new Set(movie.genres.map((item) => normalizeText(item.genre.name)));
}

function castSet(movie: MovieWithRelations) {
  return new Set(movie.cast.map((item) => normalizeText(item.person.nameRu)));
}

function intersectCount<T>(a: Set<T>, b: Set<T>) {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function findThemeMatches(textA: string, textB: string) {
  return themeKeywordGroups
    .filter((group) => {
      const hasA = group.words.some((word) => textA.includes(word));
      const hasB = group.words.some((word) => textB.includes(word));
      return hasA && hasB;
    })
    .map((group) => group.name);
}

function typeReason(type: ContentType) {
  if (type === "SERIES") return "тот же формат сериала";
  if (type === "CARTOON") return "тот же формат мультфильма";
  if (type === "ANIME") return "тот же формат аниме";
  return "тот же формат полнометражного фильма";
}

export function calculateSimilarity(source: MovieWithRelations, candidate: MovieWithRelations): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (source.type === candidate.type) {
    score += 12;
    reasons.push(typeReason(source.type));
  }

  const sourceGenres = genreSet(source);
  const candidateGenres = genreSet(candidate);
  const commonGenres = [...sourceGenres].filter((genre) => candidateGenres.has(genre));
  if (commonGenres.length) {
    score += commonGenres.length * 22;
    reasons.push(`общие жанры: ${commonGenres.slice(0, 3).join(", ")}`);
  }

  const sourceDescription = normalizeText(`${source.titleRu} ${source.titleOriginal || ""} ${source.description}`);
  const candidateDescription = normalizeText(`${candidate.titleRu} ${candidate.titleOriginal || ""} ${candidate.description}`);

  const sharedTitleWords = intersectCount(new Set(tokenize(source.titleRu)), new Set(tokenize(candidate.titleRu)));
  if (sharedTitleWords) score += Math.min(sharedTitleWords * 8, 24);

  if (normalizeText(normalizeMovieBaseTitle(source.titleRu)) === normalizeText(normalizeMovieBaseTitle(candidate.titleRu))) {
    score += 30;
    reasons.push("та же серия фильмов");
  }

  const themes = findThemeMatches(sourceDescription, candidateDescription);
  if (themes.length) {
    score += themes.length * 15;
    reasons.push(`похожие темы: ${themes.slice(0, 2).join(", ")}`);
  }

  const sourceTokens = new Set(tokenize(source.description));
  const candidateTokens = new Set(tokenize(candidate.description));
  const sharedTokens = intersectCount(sourceTokens, candidateTokens);
  if (sharedTokens) {
    score += Math.min(sharedTokens * 3, 24);
    if (sharedTokens >= 3) reasons.push("похожее описание и атмосфера");
  }

  if (source.country && candidate.country && normalizeText(source.country) === normalizeText(candidate.country)) {
    score += 6;
  }

  if (source.director && candidate.director && normalizeText(source.director) === normalizeText(candidate.director)) {
    score += 18;
    reasons.push("тот же режиссёр");
  }

  const commonCast = intersectCount(castSet(source), castSet(candidate));
  if (commonCast) {
    score += Math.min(commonCast * 10, 25);
    reasons.push("есть общие актёры");
  }

  const yearDiff = Math.abs(source.year - candidate.year);
  if (yearDiff <= 3) score += 8;
  else if (yearDiff <= 8) score += 4;

  const sourceRating = source.kpRating ?? source.imdbRating ?? source.tmdbRating;
  const candidateRating = candidate.kpRating ?? candidate.imdbRating ?? candidate.tmdbRating;
  if (sourceRating && candidateRating && Math.abs(sourceRating - candidateRating) <= 0.8) {
    score += 5;
  }

  if (source.quality && candidate.quality && normalizeText(source.quality) === normalizeText(candidate.quality)) score += 2;

  if (!reasons.length) reasons.push("похожий жанр и настроение");

  return { score, reasons: Array.from(new Set(reasons)).slice(0, 4) };
}

export function sortSimilarMovies(source: MovieWithRelations, candidates: MovieWithRelations[], limit = 10) {
  return candidates
    .map((candidate) => {
      const { score, reasons } = calculateSimilarity(source, candidate);
      return { ...candidate, similarityScore: score, similarityReasons: reasons } satisfies SimilarMovieResult;
    })
    .filter((movie) => movie.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore || (b.kpRating ?? 0) - (a.kpRating ?? 0) || b.year - a.year)
    .slice(0, limit);
}

export function similarIntro(movie: MovieWithRelations) {
  const genres = movie.genres.map((item) => item.genre.name.toLowerCase()).slice(0, 3).join(", ");
  const genreText = genres ? `в жанрах ${genres}` : "с похожей атмосферой";
  return `Если вам понравился «${movie.titleRu}», ниже собраны похожие фильмы и сериалы ${genreText}. Подборка строится автоматически по жанрам, описанию, темам, актёрам, режиссёру, году и рейтингам.`;
}
