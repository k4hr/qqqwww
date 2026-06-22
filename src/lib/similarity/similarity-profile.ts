import type { Genre, Movie, MovieCast, MovieGenre, Person } from "@prisma/client";
import { ALL_SIMILARITY_CLUSTERS, CLUSTER_BY_ID, FRANCHISE_CLUSTERS } from "./similarity-clusters";
import { normalizeMovieBaseTitle } from "@/lib/seo-slugs";

export type MovieWithSimilarityRelations = Movie & {
  genres: Array<MovieGenre & { genre: Genre }>;
  cast: Array<MovieCast & { person: Person }>;
};

export type SimilarityProfile = {
  movieId: string;
  title: string;
  baseTitle: string;
  text: string;
  tokens: Set<string>;
  genreNames: Set<string>;
  castNames: Set<string>;
  franchiseIds: Set<string>;
  clusterIds: Set<string>;
  sourceTypeIds: Set<string>;
  hintKeywords: string[];
  hasStrongIdentity: boolean;
};

const TOKEN_STOP_WORDS = new Set([
  "фильм", "сериал", "мультфильм", "смотреть", "онлайн", "часть", "год", "года", "лет", "история", "жизнь", "новый", "новая",
  "герой", "герои", "однажды", "который", "которая", "которые", "после", "свой", "свои", "очень", "становится",
  "the", "and", "with", "movie", "film", "part", "new", "story",
]);

export function normalizeSimilarityText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[’'`]/g, "")
    .replace(/&/g, " and ")
    .trim();
}

export function tokenizeSimilarity(value: string | null | undefined) {
  return Array.from(new Set(
    normalizeSimilarityText(value)
      .replace(/[^a-zа-я0-9\s-]/gi, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3 && !TOKEN_STOP_WORDS.has(word)),
  ));
}

function keywordMatches(text: string, tokens: Set<string>, keyword: string) {
  const normalized = normalizeSimilarityText(keyword);
  if (!normalized) return false;
  if (normalized.includes(" ") || normalized.includes("-")) {
    return text.includes(normalized);
  }
  if (normalized.length <= 3) return tokens.has(normalized);
  return text.includes(normalized);
}

function collectText(movie: MovieWithSimilarityRelations) {
  const genres = movie.genres.map((item) => item.genre.name).join(" ");
  const cast = movie.cast.slice(0, 8).map((item) => `${item.person.nameRu} ${item.person.nameOriginal || ""}`).join(" ");
  return [
    movie.titleRu,
    movie.titleOriginal || "",
    movie.description,
    movie.country || "",
    movie.director || "",
    movie.quality || "",
    genres,
    cast,
    movie.vibixTags.join(" "),
  ].join(" ");
}

export function buildSimilarityProfile(movie: MovieWithSimilarityRelations): SimilarityProfile {
  const text = normalizeSimilarityText(collectText(movie));
  const tokens = new Set(tokenizeSimilarity(text));
  const genreNames = new Set(movie.genres.map((item) => normalizeSimilarityText(item.genre.name)));
  const castNames = new Set(movie.cast.slice(0, 10).map((item) => normalizeSimilarityText(item.person.nameRu)).filter(Boolean));
  const franchiseIds = new Set<string>();
  const clusterIds = new Set<string>();
  const sourceTypeIds = new Set<string>();
  const hintKeywords: string[] = [];

  for (const cluster of ALL_SIMILARITY_CLUSTERS) {
    const matchedKeywords = cluster.keywords.filter((keyword) => keywordMatches(text, tokens, keyword));
    if (!matchedKeywords.length) continue;
    clusterIds.add(cluster.id);
    hintKeywords.push(...matchedKeywords.slice(0, 4));
    if (cluster.kind === "franchise") franchiseIds.add(cluster.id);
    if (cluster.kind === "source") sourceTypeIds.add(cluster.id);
  }

  const baseTitle = normalizeSimilarityText(normalizeMovieBaseTitle(movie.titleRu));
  const titleTokens = tokenizeSimilarity(`${movie.titleRu} ${movie.titleOriginal || ""}`).filter((word) => word.length >= 4);
  hintKeywords.push(...titleTokens.slice(0, 5));

  return {
    movieId: movie.id,
    title: movie.titleRu,
    baseTitle,
    text,
    tokens,
    genreNames,
    castNames,
    franchiseIds,
    clusterIds,
    sourceTypeIds,
    hintKeywords: Array.from(new Set(hintKeywords.map(normalizeSimilarityText).filter(Boolean))).slice(0, 30),
    hasStrongIdentity: franchiseIds.size > 0 || [...clusterIds].some((id) => (CLUSTER_BY_ID.get(id)?.weight || 0) >= 650),
  };
}

export function getProfileClusterLabels(profile: SimilarityProfile) {
  return [...profile.clusterIds]
    .map((id) => CLUSTER_BY_ID.get(id)?.label)
    .filter((value): value is string => Boolean(value));
}

export function getProfileFranchiseLabels(profile: SimilarityProfile) {
  return [...profile.franchiseIds]
    .map((id) => FRANCHISE_CLUSTERS.find((cluster) => cluster.id === id)?.label)
    .filter((value): value is string => Boolean(value));
}
