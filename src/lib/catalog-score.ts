import { ContentType, type Movie } from "@prisma/client";
import { isAdultLikeTitle, isValidHomePoster } from "@/lib/catalog-safety";
import { prisma } from "@/lib/prisma";
import { classifyCatalogKind } from "@/lib/catalog-kind";

export type CatalogScoreMovie = Pick<Movie,
  | "id" | "titleRu" | "titleOriginal" | "description" | "year" | "type" | "posterUrl" | "backdropUrl" | "country" | "duration"
  | "kpRating" | "imdbRating" | "tmdbRating" | "kpVotes" | "imdbVotes" | "tmdbVotes" | "tmdbPopularity"
  | "vibixAvailable" | "vibixIframeUrl" | "vibixEmbedCode" | "vibixTags" | "vibixLgbtContent"
  | "isPublished" | "isCatalogAllowed" | "homeScore" | "trendScore" | "qualityScore" | "evergreenScore" | "views" | "likes"
> & { genres?: { genre: { name: string; slug?: string } }[] };

export type CatalogScoreResult = {
  catalogScore: number;
  popularScore: number;
  topScore: number;
  freshScore: number;
  isPublicVisible: boolean;
  isPopularEligible: boolean;
  isTopEligible: boolean;
  isFreshEligible: boolean;
};

export type CatalogBlockReason =
  | "missing_player"
  | "missing_poster"
  | "english_title"
  | "not_catalog_allowed"
  | "low_score"
  | "blocked_genre"
  | "lgbt_content"
  | "short_documentary_special"
  | "missing_votes"
  | "adult_title";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function hasText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasCatalogPlayer(movie: Partial<Pick<Movie, "vibixIframeUrl" | "vibixEmbedCode">> & Record<string, unknown>) {
  const values = [
    movie.vibixIframeUrl,
    movie.vibixEmbedCode,
    movie.iframeUrl,
    movie.playerUrl,
    movie.embedCode,
    movie.embed_code,
    movie.iframe_url,
    movie.alohaIframeUrl,
  ];
  return values.some((value) => hasText(typeof value === "string" ? value : null));
}

export function hasRussianTitle(movie: Pick<Movie, "titleRu">) {
  return /[а-яё]/iu.test(movie.titleRu ?? "");
}

function includesAny(text: string, markers: readonly string[]) {
  return markers.some((marker) => text.includes(marker));
}

function genreText(movie: CatalogScoreMovie) {
  return movie.genres?.map((item) => `${item.genre.name} ${item.genre.slug ?? ""}`).join(" ").toLocaleLowerCase("ru-RU") ?? "";
}

function isWeakFormat(movie: CatalogScoreMovie) {
  const text = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description ?? ""} ${genreText(movie)} ${movie.vibixTags.join(" ")}`.toLocaleLowerCase("ru-RU");
  const shortMovie = movie.type === ContentType.MOVIE && Boolean(movie.duration && movie.duration < 40);
  return shortMovie || includesAny(text, ["документаль", "documentary", "короткометраж", "short", "спецвыпуск", "special", "stand-up", "standup", "концерт", "телешоу", "talk show"]);
}

function isStrongMainstreamTitle(movie: CatalogScoreMovie) {
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
  return votes >= 50_000 || (votes >= 5_000 && rating >= 7.4) || franchiseBonus(movie) > 0;
}

function hasExplicitAdultSignal(movie: CatalogScoreMovie) {
  const text = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description ?? ""} ${movie.vibixTags.join(" ")}`.toLocaleLowerCase("ru-RU");
  return isAdultLikeTitle(movie) || includesAny(text, ["adult", "erotic", "эротик", "порно", "porn", "для взрослых"]);
}

function hasLgbtSignal(movie: CatalogScoreMovie) {
  const text = `${movie.titleRu} ${movie.titleOriginal ?? ""} ${movie.description ?? ""} ${movie.vibixTags.join(" ")}`.toLocaleLowerCase("ru-RU");
  return (movie.vibixLgbtContent ?? 0) > 0 || includesAny(text, ["lgbt", "лгбт"]);
}

function isBlocked(movie: CatalogScoreMovie) {
  if (hasExplicitAdultSignal(movie)) return true;
  // Vibix иногда ставит lgbt_content=1 на крупные mainstream-тайтлы
  // вроде “Игры престолов”. Это не должно полностью выкидывать тайтл
  // из публичного каталога; такой флаг учитываем только как soft-risk.
  if (hasLgbtSignal(movie) && !isStrongMainstreamTitle(movie)) return true;
  return false;
}

function isMassCountry(movie: CatalogScoreMovie) {
  const text = (movie.country ?? "").toLocaleLowerCase("ru-RU");
  return includesAny(text, ["сша", "usa", "united states", "великобрит", "united kingdom", "канада", "canada", "франц", "france", "герман", "germany", "корея", "korea", "япон", "japan", "испан", "spain", "итал", "italy"]);
}

function isMassGenre(movie: CatalogScoreMovie) {
  return includesAny(genreText(movie), ["боев", "action", "триллер", "thriller", "фантаст", "sci", "криминал", "crime", "комед", "comedy", "драма", "drama", "приключ", "adventure", "ужас", "horror", "фэнтези", "fantasy"]);
}

function franchiseBonus(movie: CatalogScoreMovie) {
  const text = `${movie.titleRu} ${movie.titleOriginal ?? ""}`.toLocaleLowerCase("ru-RU");
  const markers = ["marvel", "мстител", "человек-паук", "spider-man", "spider man", "iron man", "железн", "гарри поттер", "harry potter", "властелин колец", "lord of the rings", "хоббит", "hobbit", "звездн", "star wars", "интерстеллар", "джентльмен", "game of thrones", "игра престолов", "ходяч", "walking dead"];
  return includesAny(text, markers) ? 8 : 0;
}

export function calculateCatalogScore(movie: CatalogScoreMovie): CatalogScoreResult {
  const player = hasCatalogPlayer(movie);
  const poster = isValidHomePoster(movie.posterUrl);
  const backdrop = isValidHomePoster(movie.backdropUrl);
  const russianTitle = hasRussianTitle(movie);
  const rating = Math.max(movie.kpRating ?? 0, movie.imdbRating ?? 0, movie.tmdbRating ?? 0);
  const votes = Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0);
  const logVotes = Math.log10(Math.max(1, votes));
  const currentYear = new Date().getFullYear();
  const recency = clamp((movie.year - (currentYear - 5)) * 3, 0, 18);
  const freshYear = movie.year >= currentYear - 2;
  const weakFormat = isWeakFormat(movie);
  const blocked = isBlocked(movie);
  const massGenre = isMassGenre(movie);
  const massCountry = isMassCountry(movie);
  const safeBase = movie.isPublished && movie.isCatalogAllowed && !blocked && player && poster && russianTitle;

  let catalogScore = 0;
  catalogScore += poster ? 18 : -25;
  catalogScore += player ? 28 : -40;
  catalogScore += russianTitle ? 14 : -15;
  catalogScore += backdrop ? 6 : 0;
  catalogScore += rating * 4.4;
  catalogScore += Math.min(26, logVotes * 5.2);
  catalogScore += massGenre ? 5 : 0;
  catalogScore += massCountry ? 4 : 0;
  catalogScore += movie.views ? Math.min(8, Math.log10(1 + movie.views) * 3) : 0;
  catalogScore += movie.likes ? Math.min(6, Math.log10(1 + movie.likes) * 4) : 0;
  catalogScore += weakFormat ? -18 : 0;
  catalogScore += blocked ? -60 : 0;
  catalogScore = clamp(catalogScore);

  let popularScore = catalogScore * 0.42 + rating * 6 + Math.min(36, logVotes * 7) + recency + (massGenre ? 8 : 0) + (massCountry ? 5 : 0) + franchiseBonus(movie);
  if (weakFormat) popularScore -= 28;
  if (!votes && rating < 7) popularScore -= 12;
  popularScore = clamp(popularScore);

  let topScore = catalogScore * 0.35 + rating * 8 + Math.min(42, logVotes * 8.2) + franchiseBonus(movie) + (backdrop ? 4 : 0);
  if (movie.year <= currentYear - 4 && rating >= 7) topScore += 8;
  if (weakFormat || votes < 500) topScore -= 18;
  topScore = clamp(topScore);

  let freshScore = catalogScore * 0.38 + (freshYear ? 30 : 0) + recency + rating * 4 + Math.min(22, logVotes * 4.5) + (toNumber(movie.tmdbPopularity) ? Math.min(12, Math.log10(1 + toNumber(movie.tmdbPopularity)) * 6) : 0);
  if (!freshYear) freshScore -= 18;
  if (weakFormat && votes < 10_000) freshScore -= 12;
  freshScore = clamp(freshScore);

  const isPublicVisible = safeBase && catalogScore >= 36;
  const isPopularEligible = isPublicVisible && !weakFormat && popularScore >= 50 && (votes >= 50 || rating >= 6.7 || movie.views > 0);
  const isTopEligible = isPublicVisible && !weakFormat && topScore >= 60 && rating >= 6.8 && (votes >= 500 || franchiseBonus(movie) > 0);
  const isFreshEligible = isPublicVisible && freshYear && freshScore >= 48 && (votes >= 1 || rating >= 5.5 || movie.vibixAvailable);

  return {
    catalogScore,
    popularScore,
    topScore,
    freshScore,
    isPublicVisible,
    isPopularEligible,
    isTopEligible,
    isFreshEligible,
  };
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function getCatalogBlockReasons(movie: CatalogScoreMovie, score = calculateCatalogScore(movie)): CatalogBlockReason[] {
  const reasons: CatalogBlockReason[] = [];
  if (!hasCatalogPlayer(movie)) reasons.push("missing_player");
  if (!isValidHomePoster(movie.posterUrl)) reasons.push("missing_poster");
  if (!hasRussianTitle(movie)) reasons.push("english_title");
  if (!movie.isPublished || !movie.isCatalogAllowed) reasons.push("not_catalog_allowed");
  if (hasLgbtSignal(movie) && !isStrongMainstreamTitle(movie)) reasons.push("lgbt_content");
  if (hasExplicitAdultSignal(movie)) reasons.push("adult_title");
  if (isBlocked(movie)) reasons.push("blocked_genre");
  if (isWeakFormat(movie)) reasons.push("short_documentary_special");
  if (Math.max(movie.kpVotes ?? 0, movie.imdbVotes ?? 0, movie.tmdbVotes ?? 0) <= 0) reasons.push("missing_votes");
  if (score.catalogScore < 36) reasons.push("low_score");
  return Array.from(new Set(reasons));
}

export async function recalculateAllCatalogScores() {
  let cursor: string | undefined;
  const blockReasons: Record<CatalogBlockReason, number> = {
    missing_player: 0,
    missing_poster: 0,
    english_title: 0,
    not_catalog_allowed: 0,
    low_score: 0,
    blocked_genre: 0,
    lgbt_content: 0,
    short_documentary_special: 0,
    missing_votes: 0,
    adult_title: 0,
  };
  const result = { processed: 0, publicVisible: 0, popularEligible: 0, topEligible: 0, freshEligible: 0, blocked: 0, errors: 0, blockReasons };
  while (true) {
    const movies = await prisma.movie.findMany({
      where: { isPublished: true },
      include: { genres: { include: { genre: true } } },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!movies.length) break;
    for (const movie of movies) {
      try {
        const catalogKind = classifyCatalogKind(movie);
        const typedMovie = { ...movie, type: catalogKind };
        const score = calculateCatalogScore(typedMovie);
        const reasons = getCatalogBlockReasons(typedMovie, score);
        await prisma.movie.update({ where: { id: movie.id }, data: { type: catalogKind, ...score, lastCatalogScoreAt: new Date() } });
        result.processed += 1;
        if (score.isPublicVisible) result.publicVisible += 1;
        if (score.isPopularEligible) result.popularEligible += 1;
        if (score.isTopEligible) result.topEligible += 1;
        if (score.isFreshEligible) result.freshEligible += 1;
        if (!score.isPublicVisible) {
          result.blocked += 1;
          for (const reason of reasons) result.blockReasons[reason] += 1;
        }
      } catch (error) {
        result.errors += 1;
        console.error("Catalog score recalculation failed", movie.id, error instanceof Error ? error.message : error);
      }
    }
    cursor = movies.at(-1)!.id;
  }
  return result;
}
