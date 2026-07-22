import assert from "node:assert/strict";
import { ContentType } from "@prisma/client";
import { explainSearchResult, normalizeSearchQuery, scoreSearchResult, type SearchMovie } from "@/lib/search";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";
import { normalizeSearchText, parseSearchIntent } from "@/lib/search-v2";

function movie(input: Partial<SearchMovie> & Pick<SearchMovie, "titleRu" | "slug" | "year" | "type">): SearchMovie {
  return {
    id: input.id ?? input.slug,
    titleRu: input.titleRu,
    titleOriginal: input.titleOriginal ?? null,
    description: input.description ?? "",
    year: input.year,
    type: input.type,
    posterUrl: input.posterUrl ?? "poster.jpg",
    backdropUrl: input.backdropUrl ?? null,
    trailerUrl: input.trailerUrl ?? null,
    country: input.country ?? null,
    director: input.director ?? null,
    ageRating: input.ageRating ?? null,
    quality: input.quality ?? "WEB-DL",
    duration: input.duration ?? null,
    kinopoiskId: input.kinopoiskId ?? null,
    imdbId: input.imdbId ?? null,
    tmdbId: input.tmdbId ?? null,
    allohaId: input.allohaId ?? null,
    vibixId: input.vibixId ?? null,
    vibixIframeUrl: input.vibixIframeUrl ?? "https://player.example",
    vibixEmbedCode: input.vibixEmbedCode ?? null,
    vibixAvailable: input.vibixAvailable ?? true,
    vibixType: input.vibixType ?? null,
    vibixUploadedAt: input.vibixUploadedAt ?? null,
    vibixUpdatedAt: input.vibixUpdatedAt ?? null,
    vibixLastSyncAt: input.vibixLastSyncAt ?? null,
    vibixTags: input.vibixTags ?? [],
    vibixVoiceovers: input.vibixVoiceovers ?? [],
    vibixLgbtContent: input.vibixLgbtContent ?? null,
    vibixSeasonCount: input.vibixSeasonCount ?? null,
    vibixEpisodeCount: input.vibixEpisodeCount ?? null,
    isCatalogAllowed: input.isCatalogAllowed ?? true,
    catalogBlockReason: input.catalogBlockReason ?? null,
    normalizedCountries: input.normalizedCountries ?? [],
    catalogCheckedAt: input.catalogCheckedAt ?? null,
    kpRating: input.kpRating ?? null,
    imdbRating: input.imdbRating ?? null,
    tmdbRating: input.tmdbRating ?? null,
    kpVotes: input.kpVotes ?? null,
    imdbVotes: input.imdbVotes ?? null,
    tmdbVotes: input.tmdbVotes ?? null,
    tmdbPopularity: input.tmdbPopularity ?? null,
    homeScore: input.homeScore ?? 0,
    trendScore: input.trendScore ?? 0,
    qualityScore: input.qualityScore ?? 0,
    catalogScore: input.catalogScore ?? 0,
    popularScore: input.popularScore ?? 0,
    topScore: input.topScore ?? 0,
    freshScore: input.freshScore ?? 0,
    evergreenScore: input.evergreenScore ?? 0,
    articleMentionScore: input.articleMentionScore ?? 0,
    franchiseScore: input.franchiseScore ?? 0,
    actorPowerScore: input.actorPowerScore ?? 0,
    isHomeEligible: input.isHomeEligible ?? false,
    isHeroEligible: input.isHeroEligible ?? false,
    isTrendingEligible: input.isTrendingEligible ?? false,
    isEvergreenEligible: input.isEvergreenEligible ?? false,
    isPublicVisible: input.isPublicVisible ?? true,
    isPopularEligible: input.isPopularEligible ?? false,
    isTopEligible: input.isTopEligible ?? false,
    isFreshEligible: input.isFreshEligible ?? false,
    isQualityDataComplete: input.isQualityDataComplete ?? true,
    lastTrendSyncAt: input.lastTrendSyncAt ?? null,
    lastQualitySyncAt: input.lastQualitySyncAt ?? null,
    lastCatalogScoreAt: input.lastCatalogScoreAt ?? null,
    similarityCalculatedAt: input.similarityCalculatedAt ?? null,
    similarityDirty: input.similarityDirty ?? false,
    similarityDirtyReason: input.similarityDirtyReason ?? null,
    lastVibixEnrichedAt: input.lastVibixEnrichedAt ?? null,
    lastVibixSeenAt: input.lastVibixSeenAt ?? null,
    lastExternalEnrichmentAt: input.lastExternalEnrichmentAt ?? null,
    isPublished: input.isPublished ?? true,
    views: input.views ?? 0,
    likes: input.likes ?? 0,
    dislikes: input.dislikes ?? 0,
    createdAt: input.createdAt ?? new Date("2026-01-01"),
    updatedAt: input.updatedAt ?? new Date("2026-01-01"),
    genres: input.genres ?? [],
  } as SearchMovie;
}

const ironMan = movie({ titleRu: "Железный человек", titleOriginal: "Iron Man", slug: "zheleznyy-chelovek-2008", year: 2008, type: ContentType.MOVIE, kinopoiskId: "61237", imdbId: "tt0371746" });
const from = movie({ titleRu: "Извне", titleOriginal: "From", slug: "izvne-2022", year: 2022, type: ContentType.SERIES, vibixSeasonCount: 4 });
const johnWick = movie({ titleRu: "Джон Уик 4", titleOriginal: "John Wick: Chapter 4", slug: "dzhon-uik-4-2023", year: 2023, type: ContentType.MOVIE });
const rocky = movie({ titleRu: "Рокки IV", titleOriginal: "Rocky IV", slug: "rokki-iv-1985", year: 1985, type: ContentType.MOVIE });
const popularNoise = movie({ titleRu: "Случайный популярный фильм", titleOriginal: "Popular Noise", slug: "popular-noise", year: 2026, type: ContentType.MOVIE, popularScore: 9999, kpRating: 9.9 });

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("normalizes yo/e and punctuation", () => {
  assert.equal(normalizeSearchQuery("Ёлки"), "елки");
  assert.equal(normalizeSearchText("Человек—паук").spaced, "человек паук");
  assert.equal(normalizeSearchText("человек: паук").compact, "человекпаук");
});

test("parses generic catalog intents without stealing title queries", () => {
  assert.equal(resolveSearchRedirectPath("смотреть аниме")?.href, "/anime");
  assert.equal(resolveSearchRedirectPath("смотреть сериалы")?.href, "/series");
  assert.equal(resolveSearchRedirectPath("смотреть фильм")?.href, "/films");
  assert.equal(resolveSearchRedirectPath("фильм Iron Man"), null);
  assert.equal(resolveSearchRedirectPath("аниме Наруто"), null);
});

test("parses season and episode formats", () => {
  assert.equal(parseSearchIntent("Извне 4 сезон").season?.season, 4);
  assert.equal(parseSearchIntent("Извне сезон 4").season?.season, 4);
  assert.equal(parseSearchIntent("From S04E02").season?.season, 4);
  assert.equal(parseSearchIntent("From S04E02").season?.episode, 2);
  assert.equal(parseSearchIntent("Извне 4x02").season?.episode, 2);
});

test("does not parse franchise part/year as season", () => {
  assert.equal(parseSearchIntent("Джон Уик 4").season, undefined);
  assert.equal(parseSearchIntent("Рокки IV").season, undefined);
  assert.equal(parseSearchIntent("Извне 2022").season, undefined);
});

test("scores exact and original titles above popular noise", () => {
  assert.ok(scoreSearchResult(ironMan, "Iron Man") > scoreSearchResult(popularNoise, "Iron Man"));
  assert.ok(scoreSearchResult(ironMan, "Железный человек") > scoreSearchResult(popularNoise, "Железный человек"));
});

test("supports ids, transliteration, keyboard layout and typo provenance", () => {
  assert.ok(explainSearchResult(ironMan, "tt0371746").provenance.includes("ID"));
  assert.ok(scoreSearchResult(ironMan, "zhelezny chelovek") > 0);
  assert.ok(scoreSearchResult(ironMan, "Железний человек") > 0);
  assert.ok(scoreSearchResult(ironMan, ";tktypysq xtkjdtr") > 0);
});

test("season query boosts series", () => {
  assert.ok(scoreSearchResult(from, "From S4") > scoreSearchResult(johnWick, "From S4"));
});

console.log("Search unit tests completed.");
