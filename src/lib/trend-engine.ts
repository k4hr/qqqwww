import { ContentType, type Movie, type Prisma, type TrendCandidate } from "@prisma/client";
import { calculateHomeQuality } from "@/lib/home-quality-score";
import { evaluateMovieCatalogVisibility } from "@/lib/catalog-filters";
import { toTimestamp } from "@/lib/date-utils";
import { getRecentPopularityStats } from "@/lib/popularity";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isAdultLikeTitle } from "@/lib/catalog-safety";
import {
  discoverTmdb,
  getPopularByYear,
  getTmdbCollection,
  getTmdbDetails,
  getTopRatedByYear,
  getTrendingMovies,
  getTrendingSeries,
  searchTmdbEntity,
  tmdbImage,
  type TmdbSummary,
} from "@/lib/tmdb";
import { TREND_SOURCE_RULES } from "@/lib/trend-sources";
import {
  getVibixSerialByImdbIdResult,
  getVibixSerialByKpIdResult,
  getVibixKpIds,
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpIdResult,
  searchVibixVideoResult,
  sleep,
  type VibixCatalogType,
  type VibixVideo,
} from "@/lib/vibix";
import { saveVibixVideo } from "@/lib/vibix-sync";

const trendState = globalThis as typeof globalThis & { __redfilmTrendSyncRunning?: boolean };
const CANDIDATE_STATUSES = ["PENDING", "NOT_IN_VIBIX", "NEEDS_ENRICHMENT", "FAILED"];

type CandidateInput = {
  type: ContentType;
  item: TmdbSummary;
  source: string;
  category: string;
  rank: number;
  bonus?: number;
  imdbId?: string | null;
  kpId?: string | null;
};

function yearOf(item: TmdbSummary) {
  return Number((item.release_date ?? item.first_air_date ?? "").slice(0, 4)) || null;
}

function candidateScore(item: TmdbSummary, rank: number, bonus = 0) {
  const votes = item.vote_count ?? 0;
  return Math.max(0, (item.popularity ?? 0) * 0.25 + (item.vote_average ?? 0) * 4 + Math.log10(Math.max(1, votes)) * 8 + bonus - rank * 0.15);
}

async function upsertCandidate(input: CandidateInput) {
  const item = input.item;
  const tmdbId = String(item.id);
  const data = {
    type: input.type,
    titleRu: item.title ?? item.name,
    titleOriginal: item.original_title ?? item.original_name ?? item.title ?? item.name ?? `TMDB ${tmdbId}`,
    year: yearOf(item),
    tmdbId,
    source: input.source,
    sourceCategory: input.category,
    sourceRank: input.rank,
    sourceScore: candidateScore(item, input.rank, input.bonus),
    tmdbPopularity: item.popularity,
    tmdbVoteAverage: item.vote_average,
    tmdbVoteCount: item.vote_count,
    posterUrl: tmdbImage(item.poster_path),
    backdropUrl: tmdbImage(item.backdrop_path, "w1280"),
    imdbId: input.imdbId,
    kpId: input.kpId,
  };
  const existing = await prisma.trendCandidate.findFirst({ where: { type: input.type, tmdbId, source: input.source, sourceCategory: input.category }, select: { id: true, status: true, lastCheckedAt: true } });
  const staleMissing = existing?.status === "NOT_IN_VIBIX" && toTimestamp(existing.lastCheckedAt) < Date.now() - 12 * 3_600_000;
  const staleLowQuality = existing?.status === "LOW_QUALITY" && toTimestamp(existing.lastCheckedAt) < Date.now() - 24 * 3_600_000;
  const status = !existing || staleMissing || staleLowQuality || ["FAILED", "NEEDS_ENRICHMENT"].includes(existing.status) ? "PENDING" : existing.status;
  return existing
    ? prisma.trendCandidate.update({ where: { id: existing.id }, data: { ...data, status } })
    : prisma.trendCandidate.create({ data: { ...data, status } });
}

async function collectCandidates() {
  const year = new Date().getFullYear();
  const groups: CandidateInput[][] = [];
  const add = (items: TmdbSummary[], type: ContentType, source: string, category: string, bonus = 0) => {
    groups.push(items.map((item, rank) => ({ type, item, source, category, rank: rank + 1, bonus })));
  };

  add(await getTrendingMovies("day"), ContentType.MOVIE, "TMDB_TRENDING_DAY", "trending", 20);
  add(await getTrendingMovies("week"), ContentType.MOVIE, "TMDB_TRENDING_WEEK", "trending", 16);
  add(await getTrendingSeries("day"), ContentType.SERIES, "TMDB_TRENDING_DAY", "trending", 20);
  add(await getTrendingSeries("week"), ContentType.SERIES, "TMDB_TRENDING_WEEK", "trending", 16);
  for (const targetYear of [year + 1, year, year - 1, year - 2]) {
    add(await getPopularByYear(ContentType.MOVIE, targetYear), ContentType.MOVIE, "TMDB_DISCOVER_YEAR", `popular_${targetYear}`, 10);
    add(await getPopularByYear(ContentType.SERIES, targetYear), ContentType.SERIES, "TMDB_DISCOVER_YEAR", `popular_${targetYear}`, 10);
  }
  for (const targetYear of [year, year - 1, 2025, 2024, 2023, 2022, 2021, 2020].filter((value, index, all) => all.indexOf(value) === index)) {
    add(await getTopRatedByYear(ContentType.MOVIE, targetYear), ContentType.MOVIE, "TMDB_TOP_RATED", "top_rated", 8);
    add(await getTopRatedByYear(ContentType.SERIES, targetYear), ContentType.SERIES, "TMDB_TOP_RATED", "top_rated", 8);
  }

  for (const rule of TREND_SOURCE_RULES) {
    const entityId = rule.entityId ?? (rule.query && rule.entity !== "network" ? (await searchTmdbEntity(rule.entity, rule.query))[0]?.id : undefined);
    if (!entityId) continue;
    const items = rule.entity === "collection"
      ? await getTmdbCollection(entityId)
      : await discoverTmdb(rule.type, { [rule.discoverParam!]: entityId, sort_by: "popularity.desc", "vote_count.gte": 25 });
    add(items, rule.type, rule.source, rule.category, rule.weight);
  }

  const mentions = await prisma.externalArticleMention.findMany({
    where: { tmdbId: { not: null }, detectedType: { not: null } },
    orderBy: [{ mentionScore: "desc" }, { publishedAt: "desc" }],
    take: 200,
  });
  groups.push(mentions.map((mention, rank) => ({
    type: mention.detectedType!,
    item: { id: Number(mention.tmdbId), title: mention.detectedTitle ?? mention.title, release_date: mention.detectedYear ? `${mention.detectedYear}-01-01` : undefined },
    source: "ARTICLE_MENTION",
    category: "article_mention",
    rank: rank + 1,
    bonus: mention.mentionScore,
    imdbId: mention.imdbId,
    kpId: mention.kpId,
  })).filter((item) => Number.isFinite(item.item.id)));

  let count = 0;
  for (const group of groups) {
    for (const candidate of group) {
      await upsertCandidate(candidate);
      count += 1;
    }
  }
  return count;
}

async function replaceMovieRelations(movieId: string, genres: string[], cast: string[]) {
  await prisma.movieGenre.deleteMany({ where: { movieId } });
  for (const name of genres) {
    const genreSlug = slugify(name);
    const genre = await prisma.genre.findFirst({ where: { OR: [{ name }, { slug: genreSlug }] } })
      ?? await prisma.genre.create({ data: { name, slug: genreSlug } });
    await prisma.movieGenre.create({ data: { movieId, genreId: genre.id } });
  }
  await prisma.movieCast.deleteMany({ where: { movieId } });
  for (const [index, name] of cast.slice(0, 10).entries()) {
    const person = await prisma.person.findFirst({ where: { nameRu: name } }) ?? await prisma.person.create({ data: { nameRu: name } });
    await prisma.movieCast.create({ data: { movieId, personId: person.id, sortOrder: index } });
  }
}

export async function recalculateMovieHomeScore(movieId: string, behaviorBonus = 0) {
  const movie = await prisma.movie.findUnique({ where: { id: movieId }, include: { genres: { include: { genre: true } } } });
  if (!movie) return null;
  const score = calculateHomeQuality(movie, behaviorBonus);
  return prisma.movie.update({ where: { id: movieId }, data: { ...score, lastQualitySyncAt: new Date(), lastTrendSyncAt: new Date() } });
}

export async function recalculateAllHomeScores() {
  const stats = await getRecentPopularityStats(14);
  let cursor: string | undefined;
  const result = { processed: 0, homeEligible: 0, heroEligible: 0, trendingEligible: 0, blocked: 0, errors: 0 };
  while (true) {
    const movies = await prisma.movie.findMany({ where: { isPublished: true }, include: { genres: { include: { genre: true } } }, orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!movies.length) break;
    for (const movie of movies) {
      try {
        const behavior = Math.min(20, Math.log10(1 + (stats.get(movie.id)?.total ?? 0)) * 7);
        const score = calculateHomeQuality(movie, behavior);
        await prisma.movie.update({ where: { id: movie.id }, data: { ...score, lastQualitySyncAt: new Date(), lastTrendSyncAt: new Date() } });
        result.processed += 1;
        if (score.isHomeEligible) result.homeEligible += 1;
        if (score.isHeroEligible) result.heroEligible += 1;
        if (score.isTrendingEligible) result.trendingEligible += 1;
        if (!movie.isCatalogAllowed
          || isAdultLikeTitle(movie)
          || (movie.vibixLgbtContent ?? 0) > 0
          || movie.vibixTags.some((tag) => /adult|erotic|porn|lgbt|эрот|порно|лгбт/iu.test(tag))) result.blocked += 1;
      } catch (error) {
        result.errors += 1;
        console.error("Trend score recalculation failed", movie.id, error instanceof Error ? error.message : error);
      }
    }
    cursor = movies.at(-1)!.id;
  }
  return result;
}

async function findVibix(
  candidate: TrendCandidate,
  options: { imdbId?: string; kpId?: string | null; title?: string; year?: number; type: ContentType },
) {
  if (options.imdbId || candidate.imdbId) {
    const result = await getVibixVideoByImdbIdResult(options.imdbId ?? candidate.imdbId!);
    if (result.video || result.rateLimited) return result;
  }
  if (options.kpId || candidate.kpId) {
    const result = await getVibixVideoByKpIdResult(options.kpId ?? candidate.kpId!);
    if (result.video || result.rateLimited) return result;
  }
  const title = options.title ?? candidate.titleRu ?? candidate.titleOriginal;
  if (title) return searchVibixVideoResult(title, { year: options.year ?? candidate.year ?? undefined, type: options.type === ContentType.SERIES ? "serial" : "movie" });
  return { video: null, rateLimited: false, retryAfterMs: null, requestFailed: false, error: null };
}

async function verifyVibixSeries(imdbId?: string | number | null, kpId?: string | number | null) {
  if (imdbId) {
    const result = await getVibixSerialByImdbIdResult(imdbId);
    if (result.serial || result.rateLimited) return result;
  }
  if (kpId) return getVibixSerialByKpIdResult(kpId);
  return { serial: null, rateLimited: false, retryAfterMs: null, requestFailed: false, error: null };
}

function updateCandidateGroup(candidate: TrendCandidate, data: Prisma.TrendCandidateUpdateManyMutationInput) {
  return prisma.trendCandidate.updateMany({
    where: candidate.tmdbId ? { type: candidate.type, tmdbId: candidate.tmdbId } : { id: candidate.id },
    data,
  });
}

function candidateStatusForMovie(movie: Movie) {
  if (!movie.isCatalogAllowed
    || isAdultLikeTitle(movie)
    || (movie.vibixLgbtContent ?? 0) > 0
    || movie.vibixTags.some((tag) => /adult|erotic|porn|lgbt|эрот|порно|лгбт/iu.test(tag))) return "BLOCKED";
  if (!movie.isQualityDataComplete) return "NEEDS_ENRICHMENT";
  return movie.isHomeEligible ? "AVAILABLE" : "LOW_QUALITY";
}

function serialCounts(serial: Awaited<ReturnType<typeof verifyVibixSeries>>["serial"]) {
  if (!serial) return null;
  return {
    vibixSeasonCount: serial.seasons.length,
    vibixEpisodeCount: serial.seasons.reduce((total, season) => total + season.series.length, 0),
  };
}

async function processCandidateWithoutTmdb(candidate: TrendCandidate) {
  const existing = candidate.movieId
    ? await prisma.movie.findUnique({ where: { id: candidate.movieId } })
    : await prisma.movie.findFirst({ where: { OR: [
      ...(candidate.kpId ? [{ kinopoiskId: candidate.kpId }] : []),
      ...(candidate.imdbId ? [{ imdbId: candidate.imdbId }] : []),
    ] } });
  const lookup = await findVibix(candidate, {
    imdbId: candidate.imdbId ?? existing?.imdbId ?? undefined,
    kpId: candidate.kpId ?? existing?.kinopoiskId,
    title: candidate.titleRu ?? candidate.titleOriginal,
    year: candidate.year ?? existing?.year,
    type: candidate.type,
  });
  if (lookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: lookup.retryAfterMs } as const;
  if (lookup.requestFailed) return { status: "FAILED" } as const;
  if (!lookup.video) {
    await updateCandidateGroup(candidate, { status: "NOT_IN_VIBIX", lastCheckedAt: new Date() });
    return { status: "NOT_IN_VIBIX" } as const;
  }
  let serialData: ReturnType<typeof serialCounts> = null;
  if (candidate.type === ContentType.SERIES) {
    const serialLookup = await verifyVibixSeries(lookup.video.imdb_id, lookup.video.kp_id ?? lookup.video.kinopoisk_id);
    if (serialLookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: serialLookup.retryAfterMs } as const;
    serialData = serialCounts(serialLookup.serial);
  }
  const saved = await saveVibixVideo(lookup.video, existing?.id);
  if (saved.status === "skipped") {
    await updateCandidateGroup(candidate, { status: "NEEDS_ENRICHMENT", lastCheckedAt: new Date() });
    return { status: "FAILED" } as const;
  }
  if (serialData) await prisma.movie.update({ where: { id: saved.movieId }, data: serialData });
  const movie = await recalculateMovieHomeScore(saved.movieId);
  if (!movie) return { status: "FAILED" } as const;
  await updateCandidateGroup(candidate, {
    status: candidateStatusForMovie(movie),
    movieId: movie.id,
    kpId: movie.kinopoiskId,
    imdbId: movie.imdbId,
    lastCheckedAt: new Date(),
  });
  return { status: "IMPORTED" } as const;
}

async function processCandidate(candidate: TrendCandidate) {
  if (!process.env.TMDB_API_KEY?.trim() || !candidate.tmdbId) return processCandidateWithoutTmdb(candidate);
  const details = await getTmdbDetails(candidate.tmdbId!, candidate.type);
  const existing = await prisma.movie.findFirst({ where: { OR: [{ tmdbId: details.tmdbId }, ...(details.imdbId ? [{ imdbId: details.imdbId }] : [])] } });
  let movieId = existing?.id;
  let serialData: ReturnType<typeof serialCounts> = null;
  if (!existing?.vibixAvailable || (!existing.vibixIframeUrl && !existing.vibixEmbedCode)) {
    const lookup = await findVibix(candidate, { imdbId: details.imdbId, kpId: existing?.kinopoiskId, title: details.titleRu, year: details.year, type: candidate.type });
    if (lookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: lookup.retryAfterMs } as const;
    if (lookup.requestFailed) return { status: "FAILED" } as const;
    if (!lookup.video) {
      await updateCandidateGroup(candidate, { status: "NOT_IN_VIBIX", imdbId: details.imdbId, lastCheckedAt: new Date() });
      return { status: "NOT_IN_VIBIX" } as const;
    }
    if (candidate.type === ContentType.SERIES) {
      const serialLookup = await verifyVibixSeries(lookup.video.imdb_id, lookup.video.kp_id ?? lookup.video.kinopoisk_id);
      if (serialLookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: serialLookup.retryAfterMs } as const;
      serialData = serialCounts(serialLookup.serial);
    }
    const enriched: VibixVideo = {
      ...lookup.video,
      name_rus: details.titleRu || lookup.video.name_rus,
      name_original: details.titleOriginal || lookup.video.name_original,
      description: details.description || lookup.video.description,
      poster_url: details.posterUrl || lookup.video.poster_url,
      backdrop_url: details.backdropUrl || lookup.video.backdrop_url,
      imdb_id: details.imdbId || lookup.video.imdb_id,
      type: candidate.type === ContentType.SERIES ? "serial" : "movie",
    };
    const saved = await saveVibixVideo(enriched, existing?.id);
    if (saved.status === "skipped") {
      await updateCandidateGroup(candidate, { status: "NEEDS_ENRICHMENT", lastCheckedAt: new Date() });
      return { status: "FAILED" } as const;
    }
    movieId = saved.movieId;
  } else if (candidate.type === ContentType.SERIES) {
    const serialLookup = await verifyVibixSeries(details.imdbId ?? existing.imdbId, existing.kinopoiskId);
    if (serialLookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: serialLookup.retryAfterMs } as const;
    serialData = serialCounts(serialLookup.serial);
  }
  if (!movieId) return { status: "FAILED" } as const;
  if (serialData) await prisma.movie.update({ where: { id: movieId }, data: serialData });
  await prisma.movie.update({
    where: { id: movieId },
    data: {
      titleRu: details.titleRu,
      titleOriginal: details.titleOriginal,
      description: details.description,
      year: details.year,
      tmdbId: details.tmdbId,
      imdbId: details.imdbId,
      tmdbRating: details.tmdbRating,
      tmdbVotes: details.tmdbVotes,
      tmdbPopularity: details.tmdbPopularity,
      posterUrl: details.posterUrl,
      backdropUrl: details.backdropUrl,
      country: details.country,
      ...(details.country ? evaluateMovieCatalogVisibility({ country: details.country }) : {}),
      duration: details.duration,
      director: details.director,
      trailerUrl: details.trailerUrl,
      franchiseScore: details.collectionId ? 12 : 0,
      actorPowerScore: Math.min(15, details.castPopularity ?? details.cast.length),
      lastExternalEnrichmentAt: new Date(),
    },
  });
  await replaceMovieRelations(movieId, details.genres, details.cast);
  const scored = await recalculateMovieHomeScore(movieId);
  const candidateStatus = scored ? candidateStatusForMovie(scored) : "FAILED";
  await updateCandidateGroup(candidate, { status: candidateStatus, movieId, imdbId: details.imdbId, lastCheckedAt: new Date() });
  return { status: "IMPORTED" } as const;
}

function vibixNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function upsertVibixFirstCandidate(video: VibixVideo, movie: Movie, sourceCategory: string, sourceRank: number) {
  const type = movie.type === ContentType.SERIES ? ContentType.SERIES : ContentType.MOVIE;
  const kpId = movie.kinopoiskId ?? (video.kp_id ? String(video.kp_id) : null);
  const sourceScore = Math.log10(1 + Math.max(vibixNumber(video.kp_votes), vibixNumber(video.imdb_votes))) * 10
    + Math.max(vibixNumber(video.kp_rating), vibixNumber(video.imdb_rating)) * 4;
  const data = {
    type,
    titleRu: movie.titleRu,
    titleOriginal: movie.titleOriginal ?? movie.titleRu,
    year: movie.year,
    imdbId: movie.imdbId,
    kpId,
    source: "VIBIX_KPIDS",
    sourceCategory,
    sourceRank,
    sourceScore,
    posterUrl: movie.posterUrl,
    backdropUrl: movie.backdropUrl,
    status: candidateStatusForMovie(movie),
    movieId: movie.id,
    lastCheckedAt: new Date(),
  };
  const existing = await prisma.trendCandidate.findFirst({ where: { type, kpId, source: "VIBIX_KPIDS", sourceCategory }, select: { id: true } });
  if (existing) return prisma.trendCandidate.update({ where: { id: existing.id }, data });
  return prisma.trendCandidate.create({ data });
}

export async function runVibixFirstTrendBatch(options: { batchSize?: number; detailDelayMs?: number } = {}) {
  const batchSize = Math.min(100, Math.max(1, options.batchSize ?? Number(process.env.TREND_SYNC_BATCH_SIZE || 20)));
  const detailDelayMs = Math.max(0, options.detailDelayMs ?? Number(process.env.TREND_VIBIX_DETAIL_DELAY_MS || 1_000));
  const years = Array.from({ length: 7 }, (_, index) => 2026 - index);
  const sources = years.flatMap((year) => ([{ year, type: "movie" as const }, { year, type: "serial" as const }]));
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const rotatedSources = sources.map((_, index) => sources[(dayIndex + index) % sources.length]);
  const result = { candidatesFound: 0, imported: 0, updated: 0, skipped: 0, failed: 0, rateLimited: false, retryAfterMs: null as number | null, source: null as string | null };
  let selected: { kpId: number; type: VibixCatalogType; year: number }[] = [];

  for (const source of rotatedSources) {
    const kpIdsResult = await getVibixKpIds({ type: source.type, year: source.year, page: 1, limit: 1_000 });
    if (kpIdsResult.rateLimited) return { ...result, rateLimited: true, retryAfterMs: kpIdsResult.retryAfterMs };
    if (kpIdsResult.requestFailed || !kpIdsResult.kpIds.length) continue;
    const offset = (dayIndex * batchSize) % kpIdsResult.kpIds.length;
    const ordered = [...kpIdsResult.kpIds.slice(offset), ...kpIdsResult.kpIds.slice(0, offset)];
    selected = ordered.slice(0, batchSize).map((kpId) => ({ kpId, type: source.type, year: source.year }));
    result.source = `${source.type}:${source.year}`;
    break;
  }

  result.candidatesFound = selected.length;
  for (const [index, candidate] of selected.entries()) {
    if (index > 0 && detailDelayMs) await sleep(detailDelayMs);
    const lookup = await getVibixVideoByKpIdResult(candidate.kpId);
    if (lookup.rateLimited) {
      result.rateLimited = true;
      result.retryAfterMs = lookup.retryAfterMs;
      break;
    }
    if (lookup.requestFailed) {
      result.failed += 1;
      continue;
    }
    if (!lookup.video) {
      result.skipped += 1;
      continue;
    }
    let serialData: ReturnType<typeof serialCounts> = null;
    if (candidate.type === "serial") {
      const serialLookup = await verifyVibixSeries(lookup.video.imdb_id, lookup.video.kp_id ?? lookup.video.kinopoisk_id);
      if (serialLookup.rateLimited) {
        result.rateLimited = true;
        result.retryAfterMs = serialLookup.retryAfterMs;
        break;
      }
      serialData = serialCounts(serialLookup.serial);
    }
    const saved = await saveVibixVideo(lookup.video);
    if (saved.status === "skipped") {
      result.skipped += 1;
      continue;
    }
    if (serialData) await prisma.movie.update({ where: { id: saved.movieId }, data: serialData });
    const movie = await recalculateMovieHomeScore(saved.movieId);
    if (!movie) {
      result.failed += 1;
      continue;
    }
    await upsertVibixFirstCandidate(lookup.video, movie, `vibix_${candidate.type}_${candidate.year}`, index + 1);
    if (saved.status === "imported") result.imported += 1;
    else result.updated += 1;
  }
  return result;
}

export async function checkTrendCandidatesInVibix(batchSize = 25) {
  const candidates = await prisma.trendCandidate.findMany({ where: { status: { in: CANDIDATE_STATUSES } }, orderBy: { sourceScore: "desc" }, take: batchSize });
  const result = { checked: 0, imported: 0, notInVibix: 0, failed: 0, rateLimited: false, retryAfterMs: null as number | null, message: candidates.length ? null as string | null : "Нет кандидатов для проверки в Vibix." };
  for (const candidate of candidates) {
    try {
      const processed = await processCandidate(candidate);
      if (processed.status === "RATE_LIMITED") {
        result.rateLimited = true;
        result.retryAfterMs = processed.retryAfterMs;
        break;
      }
      result.checked += 1;
      if (processed.status === "IMPORTED") result.imported += 1;
      else if (processed.status === "NOT_IN_VIBIX") result.notInVibix += 1;
      else result.failed += 1;
    } catch (error) {
      result.failed += 1;
      await updateCandidateGroup(candidate, { status: "FAILED", lastCheckedAt: new Date() });
      console.error("Trend candidate failed", candidate.id, error instanceof Error ? error.message : error);
    }
  }
  return result;
}

export async function runTrendSync(options: { batchSize?: number; collect?: boolean } = {}) {
  if (trendState.__redfilmTrendSyncRunning) throw new Error("Trend sync is already running");
  trendState.__redfilmTrendSyncRunning = true;
  const run = await prisma.trendSyncRun.create({ data: { status: "RUNNING" } });
  try {
    const tmdbEnabled = Boolean(process.env.TMDB_API_KEY?.trim());
    const vibixFirst = !tmdbEnabled
      ? await runVibixFirstTrendBatch({ batchSize: options.batchSize })
      : null;
    const candidatesFound = tmdbEnabled && options.collect !== false ? await collectCandidates() : vibixFirst?.candidatesFound ?? 0;
    const checked = tmdbEnabled
      ? await checkTrendCandidatesInVibix(options.batchSize ?? Number(process.env.TREND_SYNC_BATCH_SIZE || 20))
      : {
        imported: (vibixFirst?.imported ?? 0) + (vibixFirst?.updated ?? 0),
        notInVibix: vibixFirst?.skipped ?? 0,
        failed: vibixFirst?.failed ?? 0,
        rateLimited: vibixFirst?.rateLimited ?? false,
        retryAfterMs: vibixFirst?.retryAfterMs ?? null,
      };
    await recalculateAllHomeScores();
    const status = checked.rateLimited ? "RATE_LIMITED" : "COMPLETED";
    return await prisma.trendSyncRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        candidatesFound,
        imported: checked.imported,
        notInVibix: checked.notInVibix,
        failed: checked.failed,
        message: checked.rateLimited
          ? `Vibix rate limit; retry after ${checked.retryAfterMs ?? 0} ms`
          : tmdbEnabled ? null : "TMDB_API_KEY не указан, внешние TMDB-тренды отключены. Vibix-first режим выполнен.",
      },
    });
  } catch (error) {
    await prisma.trendSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), message: error instanceof Error ? error.message : "Unknown trend sync error" } });
    throw error;
  } finally {
    trendState.__redfilmTrendSyncRunning = false;
  }
}
