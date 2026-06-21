import { ContentType, type Movie } from "@prisma/client";
import { isLowPriorityCountry } from "@/lib/catalog-filters";
import { isAdultLikeTitle, isValidHomePoster } from "@/lib/catalog-safety";

export type QualityMovie = Pick<Movie,
  | "titleRu" | "titleOriginal" | "description" | "country" | "posterUrl" | "backdropUrl"
  | "year" | "duration" | "type" | "kpRating" | "imdbRating" | "kpVotes" | "imdbVotes"
  | "tmdbRating" | "tmdbVotes" | "tmdbPopularity" | "vibixAvailable" | "vibixIframeUrl"
  | "vibixEmbedCode" | "isPublished" | "isCatalogAllowed" | "articleMentionScore"
  | "franchiseScore" | "actorPowerScore" | "views" | "likes"
> & { genres?: { genre: { name: string } }[] };

export type HomeQualityResult = {
  homeScore: number;
  trendScore: number;
  qualityScore: number;
  evergreenScore: number;
  isHomeEligible: boolean;
  isHeroEligible: boolean;
  isTrendingEligible: boolean;
  isEvergreenEligible: boolean;
  isQualityDataComplete: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function hasRussianText(value?: string | null) {
  return /[а-яё]/iu.test(value ?? "");
}

function includesAny(value: string, markers: readonly string[]) {
  return markers.some((marker) => value.includes(marker));
}

export function isValidCinematicImage(url?: string | null) {
  if (!isValidHomePoster(url)) return false;
  try {
    const parsed = new URL(url!);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function calculateHomeQuality(movie: QualityMovie, behaviorBonus = 0): HomeQualityResult {
  const currentYear = new Date().getFullYear();
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
  const poster = isValidCinematicImage(movie.posterUrl);
  const backdrop = isValidCinematicImage(movie.backdropUrl);
  const russianTitle = hasRussianText(movie.titleRu);
  const russianDescription = hasRussianText(movie.description);
  const player = movie.vibixAvailable && Boolean(movie.vibixIframeUrl || movie.vibixEmbedCode);
  const safe = !isAdultLikeTitle(movie) && !isLowPriorityCountry(movie.country);
  const recent = movie.year >= currentYear - 2;
  const established = movie.year <= currentYear - 5 && rating >= 7 && votes >= 1_000;
  const genreText = movie.genres?.map((item) => item.genre.name).join(" ").toLocaleLowerCase("ru-RU") ?? "";
  const searchable = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description} ${genreText}`.toLocaleLowerCase("ru-RU");
  const mainstreamGenre = includesAny(genreText, ["фантаст", "science fiction", "боевик", "action", "триллер", "thriller", "драма", "drama", "ужас", "horror", "приключ", "adventure", "фэнтези", "fantasy", "superhero", "катастроф", "disaster"]);
  const countryText = (movie.country ?? "").toLocaleLowerCase("ru-RU");
  const countryCodes = countryText.split(/[,;/|\s]+/).filter(Boolean);
  const massMarketCountry = includesAny(countryText, ["сша", "united states", "usa", "великобрит", "united kingdom", "great britain", "канада", "canada", "франц", "france", "герман", "germany", "испан", "spain", "итал", "italy"])
    || countryCodes.some((code) => ["us", "gb", "ca", "fr", "de", "es", "it"].includes(code));
  const shortMovie = movie.type === ContentType.MOVIE && Boolean(movie.duration && movie.duration < 40);
  const nicheFormat = includesAny(searchable, ["документаль", "documentary", "спецвыпуск", "special", "stand-up", "standup", "концерт", "concert", "телешоу", "talk show"]);
  const weakFormat = shortMovie || (nicheFormat && votes < 5_000);
  const suspiciousRating = rating >= 8 && votes < 200;

  let qualityScore = 0;
  qualityScore += poster ? 18 : -20;
  qualityScore += backdrop ? 12 : 0;
  qualityScore += russianTitle ? 12 : -12;
  qualityScore += player ? 20 : -30;
  qualityScore += movie.description && movie.description.length >= 80 && russianDescription ? 8 : 0;
  qualityScore += rating >= 7 ? 14 : rating >= 6 ? 8 : rating > 0 ? 2 : 0;
  qualityScore += Math.min(12, Math.log10(Math.max(1, votes)) * 3);
  qualityScore += mainstreamGenre ? 6 : 0;
  qualityScore += massMarketCountry ? 4 : 0;
  qualityScore += safe ? 8 : -50;
  qualityScore += weakFormat ? -12 : 0;
  qualityScore += votes < 50 ? -15 : votes < 500 ? -5 : 0;
  qualityScore += suspiciousRating ? -14 : 0;
  qualityScore = clamp(qualityScore);

  const popularity = Math.min(30, Math.log10(Math.max(1, votes)) * 5 + Math.log10(Math.max(1, movie.tmdbPopularity ?? 0)) * 4);
  const internalBehavior = Math.min(15, Math.log10(1 + movie.views + movie.likes * 3) * 5);
  const trendScore = clamp(popularity + (recent ? 24 : 6) + rating * 3 + movie.articleMentionScore + behaviorBonus + internalBehavior);
  const evergreenScore = clamp((established ? 45 : 0) + rating * 5 + Math.min(20, Math.log10(Math.max(1, votes)) * 4) + movie.franchiseScore + movie.actorPowerScore);
  const homeScore = clamp(qualityScore * 0.55 + trendScore * 0.3 + evergreenScore * 0.15 + movie.franchiseScore + movie.actorPowerScore);
  const complete = poster && backdrop && russianTitle && russianDescription && movie.description.length >= 80 && Boolean(movie.year) && rating > 0 && votes > 0 && player;
  const baseEligible = movie.isPublished && movie.isCatalogAllowed && safe && player && poster && russianTitle;

  return {
    homeScore,
    trendScore,
    qualityScore,
    evergreenScore,
    isHomeEligible: baseEligible && !weakFormat && qualityScore >= 52 && votes >= 50,
    isHeroEligible: baseEligible && backdrop && russianDescription && !weakFormat && !suspiciousRating && qualityScore >= 68 && homeScore >= 58 && rating >= 6 && votes >= 1_000,
    isTrendingEligible: baseEligible && qualityScore >= 55 && trendScore >= 45,
    isEvergreenEligible: baseEligible && qualityScore >= 60 && evergreenScore >= 55,
    isQualityDataComplete: complete,
  };
}
