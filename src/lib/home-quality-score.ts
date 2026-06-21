import { ContentType, type Movie } from "@prisma/client";
import { isLowPriorityCountry } from "@/lib/catalog-filters";
import { isAdultLikeTitle, isValidHomePoster } from "@/lib/catalog-safety";

export type QualityMovie = Pick<Movie,
  | "titleRu" | "titleOriginal" | "description" | "country" | "posterUrl" | "backdropUrl"
  | "year" | "duration" | "type" | "kpRating" | "imdbRating" | "kpVotes" | "imdbVotes"
  | "tmdbRating" | "tmdbVotes" | "tmdbPopularity" | "vibixAvailable" | "vibixIframeUrl"
  | "vibixEmbedCode" | "isPublished" | "isCatalogAllowed" | "articleMentionScore"
  | "franchiseScore" | "actorPowerScore" | "views" | "likes"
  | "vibixTags" | "vibixLgbtContent"
> & { genres?: { genre: { name: string } }[] };

export type QualityBlockReason =
  | "missing_player"
  | "missing_poster"
  | "missing_backdrop"
  | "english_title"
  | "not_catalog_allowed"
  | "low_score"
  | "blocked_genre"
  | "lgbt_content"
  | "short_documentary_special"
  | "missing_votes"
  | "unknown_error";

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

type QualityFacts = {
  rating: number;
  votes: number;
  poster: boolean;
  backdrop: boolean;
  russianTitle: boolean;
  russianDescription: boolean;
  player: boolean;
  safe: boolean;
  recent: boolean;
  established: boolean;
  weakFormat: boolean;
  suspiciousRating: boolean;
  mainstreamGenre: boolean;
  massMarketCountry: boolean;
  genreText: string;
  blockedVibix: boolean;
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

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasPlayableSource(movie: Pick<QualityMovie, "vibixIframeUrl" | "vibixEmbedCode">) {
  return hasText(movie.vibixIframeUrl) || hasText(movie.vibixEmbedCode);
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

function getFacts(movie: QualityMovie): QualityFacts {
  const currentYear = new Date().getFullYear();
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
  const poster = isValidCinematicImage(movie.posterUrl);
  const backdrop = isValidCinematicImage(movie.backdropUrl);
  const russianTitle = hasRussianText(movie.titleRu);
  const russianDescription = hasRussianText(movie.description);
  const player = hasPlayableSource(movie);
  const safeTitleCountry = !isAdultLikeTitle(movie) && !isLowPriorityCountry(movie.country);
  const recent = movie.year >= currentYear - 2;
  const established = movie.year <= currentYear - 5 && rating >= 7 && votes >= 1_000;
  const genreText = movie.genres?.map((item) => item.genre.name).join(" ").toLocaleLowerCase("ru-RU") ?? "";
  const searchable = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description} ${genreText}`.toLocaleLowerCase("ru-RU");
  const vibixTags = movie.vibixTags.join(" ").toLocaleLowerCase("ru-RU");
  const blockedVibix = (movie.vibixLgbtContent ?? 0) > 0
    || includesAny(`${searchable} ${vibixTags}`, ["adult", "erotic", "эротик", "порно", "porn", "lgbt", "лгбт"]);
  const safe = safeTitleCountry && !blockedVibix;
  const mainstreamGenre = includesAny(genreText, ["фантаст", "science fiction", "боевик", "action", "триллер", "thriller", "драма", "drama", "ужас", "horror", "приключ", "adventure", "фэнтези", "fantasy", "superhero", "катастроф", "disaster"]);
  const countryText = (movie.country ?? "").toLocaleLowerCase("ru-RU");
  const countryCodes = countryText.split(/[,;/|\s]+/).filter(Boolean);
  const massMarketCountry = includesAny(countryText, ["сша", "united states", "usa", "великобрит", "united kingdom", "great britain", "канада", "canada", "франц", "france", "герман", "germany", "испан", "spain", "итал", "italy"])
    || countryCodes.some((code) => ["us", "gb", "ca", "fr", "de", "es", "it"].includes(code));
  const shortMovie = movie.type === ContentType.MOVIE && Boolean(movie.duration && movie.duration < 40);
  const nicheFormat = includesAny(searchable, ["документаль", "documentary", "спецвыпуск", "special", "stand-up", "standup", "концерт", "concert", "телешоу", "talk show"]);
  const weakFormat = shortMovie || (nicheFormat && votes < 5_000);
  const suspiciousRating = rating >= 8 && votes > 0 && votes < 200;
  return { rating, votes, poster, backdrop, russianTitle, russianDescription, player, safe, recent, established, weakFormat, suspiciousRating, mainstreamGenre, massMarketCountry, genreText, blockedVibix };
}

export function calculateHomeQuality(movie: QualityMovie, behaviorBonus = 0): HomeQualityResult {
  const facts = getFacts(movie);
  const { rating, votes, poster, backdrop, russianTitle, russianDescription, player, safe, recent, established, weakFormat, suspiciousRating, mainstreamGenre, massMarketCountry } = facts;

  let qualityScore = 0;
  qualityScore += poster ? 18 : -20;
  qualityScore += backdrop ? 12 : 0;
  qualityScore += russianTitle ? 12 : -12;
  qualityScore += player ? 24 : -35;
  qualityScore += movie.vibixAvailable ? 4 : 0;
  qualityScore += movie.description && movie.description.length >= 80 && russianDescription ? 8 : 0;
  qualityScore += rating >= 7 ? 14 : rating >= 6 ? 8 : rating > 0 ? 2 : 0;
  qualityScore += Math.min(14, Math.log10(Math.max(1, votes)) * 3.2);
  qualityScore += mainstreamGenre ? 6 : 0;
  qualityScore += massMarketCountry ? 4 : 0;
  qualityScore += safe ? 8 : -50;
  qualityScore += weakFormat ? -16 : 0;
  qualityScore += votes <= 0 ? -3 : votes < 50 ? -8 : votes < 500 ? -3 : 0;
  qualityScore += suspiciousRating ? -14 : 0;
  qualityScore = clamp(qualityScore);

  const popularity = Math.min(34, Math.log10(Math.max(1, votes)) * 5.4 + Math.log10(Math.max(1, movie.tmdbPopularity ?? 0)) * 4);
  const internalBehavior = Math.min(15, Math.log10(1 + movie.views + movie.likes * 3) * 5);
  const trendScore = clamp(popularity + (recent ? 24 : 6) + rating * 3 + movie.articleMentionScore + behaviorBonus + internalBehavior);
  const evergreenScore = clamp((established ? 45 : 0) + rating * 5 + Math.min(22, Math.log10(Math.max(1, votes)) * 4.2) + movie.franchiseScore + movie.actorPowerScore);
  const homeScore = clamp(qualityScore * 0.55 + trendScore * 0.3 + evergreenScore * 0.15 + movie.franchiseScore + movie.actorPowerScore);
  const complete = poster && backdrop && russianTitle && russianDescription && movie.description.length >= 80 && Boolean(movie.year) && rating > 0 && votes > 0 && player;
  const baseEligible = movie.isPublished && movie.isCatalogAllowed && safe && player && poster && russianTitle;
  const enoughHomeConfidence = votes >= 1 || rating >= 5.5 || recent || movie.views > 0;
  const heroVoteConfidence = votes >= 500 || evergreenScore >= 55 || (rating >= 7 && votes >= 50);

  return {
    homeScore,
    trendScore,
    qualityScore,
    evergreenScore,
    isHomeEligible: baseEligible && !weakFormat && qualityScore >= 38 && enoughHomeConfidence,
    isHeroEligible: baseEligible && backdrop && russianDescription && !weakFormat && !suspiciousRating && qualityScore >= 56 && homeScore >= 45 && rating >= 5.8 && heroVoteConfidence,
    isTrendingEligible: baseEligible && qualityScore >= 42 && (trendScore >= 35 || (recent && votes >= 50)),
    isEvergreenEligible: baseEligible && qualityScore >= 48 && evergreenScore >= 45,
    isQualityDataComplete: complete,
  };
}

export function getQualityBlockReasons(movie: QualityMovie, score?: HomeQualityResult): QualityBlockReason[] {
  const facts = getFacts(movie);
  const result = score ?? calculateHomeQuality(movie);
  const reasons: QualityBlockReason[] = [];
  if (!facts.player) reasons.push("missing_player");
  if (!facts.poster) reasons.push("missing_poster");
  if (!facts.backdrop) reasons.push("missing_backdrop");
  if (!facts.russianTitle) reasons.push("english_title");
  if (!movie.isCatalogAllowed || !movie.isPublished) reasons.push("not_catalog_allowed");
  if (facts.blockedVibix) reasons.push("lgbt_content");
  if (!facts.safe) reasons.push("blocked_genre");
  if (facts.weakFormat) reasons.push("short_documentary_special");
  if (facts.votes <= 0) reasons.push("missing_votes");
  if (result.homeScore < 38 || result.qualityScore < 38) reasons.push("low_score");
  return Array.from(new Set(reasons.length ? reasons : ["unknown_error"]));
}
