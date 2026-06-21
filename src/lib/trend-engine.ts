import { ContentType, type Prisma, type TrendCandidate } from "@prisma/client";
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
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpIdResult,
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
  let processed = 0;
  while (true) {
    const movies = await prisma.movie.findMany({ where: { isPublished: true }, include: { genres: { include: { genre: true } } }, orderBy: { id: "asc" }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!movies.length) break;
    for (const movie of movies) {
      const behavior = Math.min(20, Math.log10(1 + (stats.get(movie.id)?.total ?? 0)) * 7);
      const score = calculateHomeQuality(movie, behavior);
      await prisma.movie.update({ where: { id: movie.id }, data: { ...score, lastQualitySyncAt: new Date(), lastTrendSyncAt: new Date() } });
      processed += 1;
    }
    cursor = movies.at(-1)!.id;
  }
  return { processed };
}

async function findVibix(candidate: TrendCandidate, imdbId?: string, kpId?: string | null) {
  if (imdbId || candidate.imdbId) {
    const result = await getVibixVideoByImdbIdResult(imdbId ?? candidate.imdbId!);
    if (result.video || result.rateLimited) return result;
  }
  if (kpId || candidate.kpId) return getVibixVideoByKpIdResult(kpId ?? candidate.kpId!);
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

async function processCandidate(candidate: TrendCandidate) {
  const details = await getTmdbDetails(candidate.tmdbId!, candidate.type);
  const existing = await prisma.movie.findFirst({ where: { OR: [{ tmdbId: details.tmdbId }, ...(details.imdbId ? [{ imdbId: details.imdbId }] : [])] } });
  let movieId = existing?.id;
  if (!existing?.vibixAvailable || (!existing.vibixIframeUrl && !existing.vibixEmbedCode)) {
    const lookup = await findVibix(candidate, details.imdbId, existing?.kinopoiskId);
    if (lookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: lookup.retryAfterMs } as const;
    if (!lookup.video) {
      await updateCandidateGroup(candidate, { status: "NOT_IN_VIBIX", imdbId: details.imdbId, lastCheckedAt: new Date() });
      return { status: "NOT_IN_VIBIX" } as const;
    }
    if (candidate.type === ContentType.SERIES) {
      const serialLookup = await verifyVibixSeries(lookup.video.imdb_id, lookup.video.kp_id ?? lookup.video.kinopoisk_id);
      if (serialLookup.rateLimited) return { status: "RATE_LIMITED", retryAfterMs: serialLookup.retryAfterMs } as const;
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
  }
  if (!movieId) return { status: "FAILED" } as const;
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
  const candidateStatus = !scored ? "FAILED"
    : !scored.isCatalogAllowed || isAdultLikeTitle(scored) ? "BLOCKED"
      : !scored.isQualityDataComplete ? "NEEDS_ENRICHMENT"
        : scored.isHomeEligible ? "AVAILABLE" : "LOW_QUALITY";
  await updateCandidateGroup(candidate, { status: candidateStatus, movieId, imdbId: details.imdbId, lastCheckedAt: new Date() });
  return { status: "IMPORTED" } as const;
}

export async function checkTrendCandidatesInVibix(batchSize = 25) {
  const candidates = await prisma.trendCandidate.findMany({ where: { status: { in: CANDIDATE_STATUSES }, tmdbId: { not: null } }, orderBy: { sourceScore: "desc" }, take: batchSize });
  const result = { checked: 0, imported: 0, notInVibix: 0, failed: 0, rateLimited: false, retryAfterMs: null as number | null };
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
    const candidatesFound = options.collect === false ? 0 : await collectCandidates();
    const checked = await checkTrendCandidatesInVibix(options.batchSize ?? Number(process.env.TREND_SYNC_BATCH_SIZE || 20));
    await recalculateAllHomeScores();
    const status = checked.rateLimited ? "RATE_LIMITED" : "COMPLETED";
    return await prisma.trendSyncRun.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), candidatesFound, imported: checked.imported, notInVibix: checked.notInVibix, failed: checked.failed, message: checked.rateLimited ? `Vibix rate limit; retry after ${checked.retryAfterMs ?? 0} ms` : null },
    });
  } catch (error) {
    await prisma.trendSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), message: error instanceof Error ? error.message : "Unknown trend sync error" } });
    throw error;
  } finally {
    trendState.__redfilmTrendSyncRunning = false;
  }
}
