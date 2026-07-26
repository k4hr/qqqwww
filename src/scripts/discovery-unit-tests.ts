import assert from "node:assert/strict";
import { ContentType } from "@prisma/client";
import {
  countryPreferenceScore,
  matchCandidatePassesFilters,
  normalizeMovieCountries,
  personalizeInitialMatchQueue,
  rerankMatchCandidatesWithDiversity,
  restoreMatchQueue,
  type MatchRankableMovie,
} from "@/lib/discovery/match-ranking";
import {
  applyTodayPreset,
  createTodayPickerState,
  resetTodayPickerState,
  toDiscoveryFilters,
  updateTodayPickerFilter,
} from "@/lib/discovery/today-picker-state";
import { defaultDiscoveryFilters, emptyMatchPreferences } from "@/lib/discovery/types";
import { isWideBackdropArtwork } from "@/lib/artwork-validation";

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function movie(id: string, input: Partial<MatchRankableMovie> = {}): MatchRankableMovie {
  return {
    id,
    titleRu: input.titleRu ?? `Фильм ${id}`,
    year: input.year ?? 2024,
    type: input.type ?? ContentType.MOVIE,
    genres: input.genres ?? [id],
    cast: input.cast ?? [`Актёр ${id}`],
    director: input.director ?? `Режиссёр ${id}`,
    country: input.country ?? "Россия",
    duration: input.duration ?? 100,
  };
}

test("normalizes one country and yo/e", () => {
  assert.deepEqual(normalizeMovieCountries("  Белоруссия  "), ["белоруссия"]);
  assert.deepEqual(normalizeMovieCountries("Ёлочная Республика"), ["елочная республика"]);
});

test("normalizes comma-separated, JSON, spaces and duplicates", () => {
  assert.deepEqual(normalizeMovieCountries("США, Великобритания, США"), ["сша", "великобритания"]);
  assert.deepEqual(normalizeMovieCountries('[" США ","Канада"]'), ["сша", "канада"]);
  assert.deepEqual(normalizeMovieCountries(""), []);
  assert.deepEqual(normalizeMovieCountries({ country: "США" }), []);
});

test("country weights score countries separately without summing all values", () => {
  assert.equal(countryPreferenceScore({ США: 3, Великобритания: 2 }, "США, Великобритания"), 3);
  assert.equal(countryPreferenceScore({ сша: -2 }, ["США", "Канада"]), -2);
});

test("strict diversity caps defer duplicate franchise/person/director", () => {
  const rows = Array.from({ length: 8 }, (_, index) => movie(`${index}`, {
    titleRu: `Сага часть ${index + 1}`,
    cast: ["Один актёр"],
    director: "Один режиссёр",
    genres: ["боевик"],
  }));
  const result = rerankMatchCandidatesWithDiversity(rows, 8, defaultDiscoveryFilters, { maxStage: 1, debug: true });
  assert.equal(result.selected.length, 1);
  assert.ok(result.diagnostics.some((item) => item.status === "rejected" && item.reasons.includes("franchise")));
});

test("diversity relaxes in controlled stages and never appends all deferred", () => {
  const rows = Array.from({ length: 8 }, (_, index) => movie(`${index}`, {
    titleRu: `Сага часть ${index + 1}`,
    cast: ["Один актёр"],
    director: "Один режиссёр",
    genres: ["боевик"],
  }));
  const result = rerankMatchCandidatesWithDiversity(rows, 8, defaultDiscoveryFilters, { debug: true });
  assert.equal(result.selected.length, 2);
  assert.equal(result.rejected.length, 6);
  assert.ok(result.diagnostics.some((item) => item.status === "selected" && item.stage === 3));
});

test("saved preferences affect the first queue and seen ids stay excluded", () => {
  const rows = [
    movie("drama", { genres: ["drama"], year: 2018 }),
    movie("scifi", { genres: ["fantastika"], year: 2024 }),
    movie("seen", { genres: ["fantastika"], year: 2023 }),
  ];
  const preferences = { ...emptyMatchPreferences(), genreWeights: { fantastika: 8 } };
  const ranked = personalizeInitialMatchQueue(rows, preferences, ["seen"], defaultDiscoveryFilters);
  assert.equal(ranked[0]?.id, "scifi");
  assert.ok(!ranked.some((item) => item.id === "seen"));
  assert.deepEqual(personalizeInitialMatchQueue([], preferences, [], defaultDiscoveryFilters), []);
});

test("undo queue restore is stable and does not duplicate a movie", () => {
  const first = movie("first");
  const second = movie("second");
  assert.deepEqual(restoreMatchQueue(first, [second]).map((item) => item.id), ["first", "second"]);
  assert.deepEqual(restoreMatchQueue(first, [first, second]).map((item) => item.id), ["first", "second"]);
});

test("next-batch filters reject wrong type/runtime/period", () => {
  const filters = { ...defaultDiscoveryFilters, type: ContentType.SERIES, runtime: "UNDER_90" as const, period: "2020S" as const };
  assert.equal(matchCandidatePassesFilters(movie("ok", { type: ContentType.SERIES, year: 2024, duration: 80 }), filters), true);
  assert.equal(matchCandidatePassesFilters(movie("movie", { type: ContentType.MOVIE, year: 2024, duration: 80 }), filters), false);
  assert.equal(matchCandidatePassesFilters(movie("long", { type: ContentType.SERIES, year: 2024, duration: 130 }), filters), false);
});

test("vertical poster cannot become a Match backdrop", () => {
  assert.equal(isWideBackdropArtwork({ url: "/poster.webp", width: 600, height: 900, aspectRatio: 2 / 3 }), false);
  assert.equal(isWideBackdropArtwork({ url: "/unknown.webp", width: null, height: null, aspectRatio: null }), false);
});

test("Today preset-only onlyNew resets when switching away from New", () => {
  const newState = applyTodayPreset(createTodayPickerState(), "new");
  assert.equal(newState.onlyNew, true);
  assert.equal(applyTodayPreset(newState, "action").onlyNew, false);
  assert.equal(applyTodayPreset(newState, "comfort").onlyNew, false);
});

test("manual onlyNew survives mood changes and reset clears all filters", () => {
  const manual = updateTodayPickerFilter(createTodayPickerState(), "onlyNew", true);
  assert.equal(applyTodayPreset(manual, "action").onlyNew, true);
  const reset = resetTodayPickerState();
  assert.deepEqual(toDiscoveryFilters(reset), defaultDiscoveryFilters);
});

test("Today next seed does not mutate active filters", () => {
  const state = updateTodayPickerFilter(applyTodayPreset(createTodayPickerState(), "dark"), "popular", true);
  const before = toDiscoveryFilters(state);
  const after = toDiscoveryFilters(state);
  assert.deepEqual(after, before);
});

console.log("Discovery unit tests completed.");
