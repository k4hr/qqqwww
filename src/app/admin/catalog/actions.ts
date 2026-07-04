"use server";

import { ContentType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { createSimilarityJob } from "@/lib/similarity/similarity-job";
import { checkTrendCandidatesInVibix, recalculateAllHomeScores, runTrendSync } from "@/lib/trend-engine";
import { classifyCatalogKind } from "@/lib/catalog-kind";
import { forceMoviesToAnimeByIds } from "@/lib/admin-anime-tools";
import { prisma } from "@/lib/prisma";
import {
  buildVibixCatalogIndexBatch,
  buildVibixPlayableLinksIndexBatch,
  diagnoseVibixManualImport,
  importMissingFromVibixIndex,
  importVibixTitleManually,
  hideMoviesWithoutVibixPlayer,
  refreshVibixCatalogAudit,
  refreshVibixCatalogSnapshots,
  refreshVibixReferences,
} from "@/lib/vibix-catalog/catalog-audit";
import type { VibixCatalogType } from "@/lib/vibix";
import { cancelVibixCatalogMagicJob, runVibixCatalogMagicJobIteration, startDailyCatalogPipelineJob, startVibixCatalogCheckJob, startVibixCatalogImportJob, startVibixCatalogMagicJob, startVibixCoverageRepairJob } from "@/lib/vibix-catalog/catalog-magic-sync";
import { VIBIX_CATEGORY_IDS } from "@/lib/vibix-catalog/vibix-taxonomy-ids";

function numberField(formData: FormData, name: string, fallback: number, min: number, max: number) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? Math.max(min, Math.min(Math.trunc(value), max)) : fallback;
}

function optionalNumberField(formData: FormData, name: string) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function optionalBooleanField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "");
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function optionalStringField(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function sourceTypeField(formData: FormData): VibixCatalogType {
  return formData.get("sourceType") === "serial" ? "serial" : "movie";
}

function redirectWithResult(result: unknown) {
  revalidatePath("/admin/catalog");
  const encoded = Buffer.from(JSON.stringify(result)).toString("base64url");
  redirect(`/admin/catalog?result=${encoded}`);
}



type AnimeRepairMovie = Prisma.MovieGetPayload<{ include: { genres: { include: { genre: true } } } }>;

function hasAnimeGenreMarker(movie: AnimeRepairMovie) {
  const text = movie.genres.map((item) => `${item.genre.name} ${item.genre.slug ?? ""}`).join(" ").toLocaleLowerCase("ru-RU");
  return text.includes("аниме") || text.includes("anime");
}

function hasJapanAnimationMarker(movie: AnimeRepairMovie) {
  const country = (movie.country ?? "").toLocaleLowerCase("ru-RU");
  const genres = movie.genres.map((item) => `${item.genre.name} ${item.genre.slug ?? ""}`).join(" ").toLocaleLowerCase("ru-RU");
  return (country.includes("япон") || country.includes("japan"))
    && (genres.includes("мульт") || genres.includes("анимац") || genres.includes("animation") || genres.includes("cartoon"));
}

function hasAnimeTag(movie: AnimeRepairMovie) {
  return movie.vibixTags.some((tag) => {
    const normalized = tag.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
    return normalized === "аниме" || normalized === "anime" || ["ova", "ona", "oav", "shounen", "shonen", "seinen", "shoujo", "shojo", "josei"].includes(normalized);
  });
}


export async function startDailyCatalogPipelineAction() {
  const job = await startDailyCatalogPipelineJob({ restart: true });
  redirectWithResult({ ok: true, message: `Ежедневный pipeline запущен. Этап: ${job.currentStage}. Worker продолжит автоматически.`, details: job });
}

export async function checkNewVibixCatalogAction() {
  const job = await startVibixCatalogCheckJob({ restart: true });
  redirectWithResult({ ok: true, message: `Проверка новых Vibix запущена. Этап: ${job.currentStage}. Worker обновит индекс и покажет missing.`, details: job });
}

export async function importFoundVibixCatalogAction() {
  const job = await startVibixCatalogImportJob({ restart: true });
  redirectWithResult({ ok: true, message: `Догрузка найденного запущена. Этап: ${job.currentStage}. Worker импортирует missing и обновит существующие карточки.`, details: job });
}

export async function queueDirtySimilarityAction() {
  const result = await createSimilarityJob({ mode: "DIRTY", batchSize: 100 });
  redirectWithResult({ ok: true, message: "Похожие для новых/dirty фильмов поставлены в очередь.", details: result });
}

export async function runTrendSyncCatalogAction() {
  const trend = await runTrendSync({ batchSize: 50 });
  const candidates = await checkTrendCandidatesInVibix(50);
  redirectWithResult({ ok: true, message: "Тренды найдены и кандидаты проверены в Vibix.", details: { trend, candidates } });
}

export async function activateTrendsCatalogAction() {
  const catalog = await recalculateAllCatalogScores();
  const home = await recalculateAllHomeScores();
  redirectWithResult({ ok: catalog.errors + home.errors === 0, message: `Витрина обновлена: каталог ${catalog.processed}, home ${home.processed}, hero ${home.heroEligible}, homeEligible ${home.homeEligible}.`, details: { catalog, home } });
}

export async function moveMoviesToAnimeAction() {
  const animeIndexes = await prisma.vibixCatalogIndex.findMany({
    where: { categoryId: VIBIX_CATEGORY_IDS.anime },
    select: { importedMovieId: true, kpId: true, imdbId: true, vibixId: true },
    take: 100_000,
  });
  const indexedMovieIds = new Set(animeIndexes.map((item) => item.importedMovieId).filter((value): value is string => Boolean(value)));
  const indexedKpIds = new Set(animeIndexes.map((item) => item.kpId).filter(Boolean));
  const indexedImdbIds = new Set(animeIndexes.map((item) => item.imdbId).filter((value): value is string => Boolean(value)));
  const indexedVibixIds = new Set(animeIndexes.map((item) => item.vibixId).filter((value): value is number => value !== null && value !== undefined));

  let cursor: string | undefined;
  const result = { scanned: 0, moved: 0, byVibixIndex: 0, byClassifier: 0, byGenre: 0, byJapanAnimation: 0, byTag: 0, examples: [] as Array<{ title: string; year: number; slug: string; reason: string }> };

  while (true) {
    const movies = await prisma.movie.findMany({
      where: {
        isPublished: true,
        OR: [
          { type: ContentType.MOVIE },
          { type: ContentType.ANIME, isPublicVisible: false },
          { type: ContentType.ANIME, isCatalogAllowed: false },
        ],
      },
      include: { genres: { include: { genre: true } } },
      orderBy: { id: "asc" },
      take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!movies.length) break;

    for (const movie of movies) {
      result.scanned += 1;
      const matchedByIndex = indexedMovieIds.has(movie.id)
        || Boolean(movie.kinopoiskId && indexedKpIds.has(movie.kinopoiskId))
        || Boolean(movie.imdbId && indexedImdbIds.has(movie.imdbId))
        || Boolean(movie.vibixId !== null && indexedVibixIds.has(movie.vibixId));
      const matchedByGenre = hasAnimeGenreMarker(movie);
      const matchedByJapanAnimation = hasJapanAnimationMarker(movie);
      const matchedByTag = hasAnimeTag(movie);
      const matchedByClassifier = classifyCatalogKind(movie) === ContentType.ANIME;

      if (!matchedByIndex && !matchedByGenre && !matchedByJapanAnimation && !matchedByTag && !matchedByClassifier) continue;

      const forced = await forceMoviesToAnimeByIds([movie.id], "admin_anime_reclassify");

      result.moved += forced.moved;
      if (matchedByIndex) result.byVibixIndex += 1;
      else if (matchedByClassifier) result.byClassifier += 1;
      else if (matchedByGenre) result.byGenre += 1;
      else if (matchedByJapanAnimation) result.byJapanAnimation += 1;
      else if (matchedByTag) result.byTag += 1;
      if (result.examples.length < 12) {
        const reason = matchedByIndex ? "vibix_category_18" : matchedByClassifier ? "catalog_classifier" : matchedByGenre ? "anime_genre" : matchedByJapanAnimation ? "japan_animation" : "anime_tag";
        result.examples.push({ title: movie.titleRu, year: movie.year, slug: movie.slug, reason });
      }
    }

    cursor = movies.at(-1)!.id;
  }

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/catalog/vibix");
  revalidatePath("/films");
  revalidatePath("/anime");
  redirectWithResult({ ok: true, message: `Перенесено в раздел аниме: ${result.moved}.`, details: result });
}


export async function hideMoviesWithoutVibixPlayerAction() {
  const result = await hideMoviesWithoutVibixPlayer({ limit: 50_000 });
  revalidatePath("/admin/catalog");
  redirectWithResult({ ok: true, message: result.message, details: result });
}


export async function startVibixCatalogMagicAction() {
  const job = await startVibixCatalogMagicJob();
  redirectWithResult({ ok: true, message: `Волшебная загрузка запущена. Статус: ${job.status}, этап: ${job.currentStage}. Worker продолжит сам.`, details: job });
}

export async function restartVibixCatalogMagicAction() {
  const job = await startVibixCatalogMagicJob({ restart: true });
  redirectWithResult({ ok: true, message: `Волшебная загрузка создана заново. Статус: ${job.status}, этап: ${job.currentStage}.`, details: job });
}

export async function runVibixCatalogMagicOnceAction() {
  const result = await runVibixCatalogMagicJobIteration({ force: true });
  redirectWithResult(result);
}

export async function cancelVibixCatalogMagicAction() {
  const job = await cancelVibixCatalogMagicJob();
  redirectWithResult({ ok: true, message: job ? "Волшебная загрузка остановлена." : "Активной волшебной загрузки нет.", details: job });
}

export async function startVibixCoverageRepairAction() {
  const job = await startVibixCoverageRepairJob();
  redirectWithResult({ ok: true, message: `Автопочинка важных тайтлов запущена. Статус: ${job.status}, этап: ${job.currentStage}. Worker продолжит сам.`, details: job });
}


export async function diagnoseVibixManualImportAction(formData: FormData) {
  const result = await diagnoseVibixManualImport({
    kpId: optionalStringField(formData, "kpId"),
    imdbId: optionalStringField(formData, "imdbId"),
    vibixId: optionalNumberField(formData, "vibixId"),
    embedCode: optionalStringField(formData, "embedCode"),
    title: optionalStringField(formData, "title"),
    type: optionalStringField(formData, "manualType"),
  });
  redirectWithResult({ ok: true, message: "Диагностика точечного импорта выполнена.", details: result });
}

export async function importVibixTitleManuallyAction(formData: FormData) {
  const result = await importVibixTitleManually({
    kpId: optionalStringField(formData, "kpId"),
    imdbId: optionalStringField(formData, "imdbId"),
    vibixId: optionalNumberField(formData, "vibixId"),
    embedCode: optionalStringField(formData, "embedCode"),
    title: optionalStringField(formData, "title"),
    year: optionalNumberField(formData, "year"),
    type: optionalStringField(formData, "manualType"),
  });
  const details = typeof result === "object" && result && "details" in result
    ? result.details as { watchUrl?: string | null }
    : null;
  if (details?.watchUrl) revalidatePath(details.watchUrl);
  redirectWithResult(result);
}

export async function refreshVibixCatalogAuditAction() {
  redirectWithResult(await refreshVibixCatalogAudit());
}

export async function refreshVibixReferencesAction() {
  redirectWithResult(await refreshVibixReferences());
}

export async function refreshVibixTotalsAction() {
  redirectWithResult(await refreshVibixCatalogSnapshots());
}

export async function buildVibixIndexAction(formData: FormData) {
  const categoryId = optionalNumberField(formData, "categoryId");
  const result = await buildVibixCatalogIndexBatch({
    sourceType: sourceTypeField(formData),
    categoryId,
    startPage: numberField(formData, "startPage", 1, 1, 100_000),
    pages: numberField(formData, "pages", 5, 1, 50),
    limit: numberField(formData, "limit", 1000, 100, 1000),
  });
  redirectWithResult({ ok: result.failed === 0, message: `Индекс Vibix: страниц ${result.scannedPages}, kpId ${result.indexed}, ошибок ${result.failed}.`, details: result });
}


export async function buildVibixPlayableLinksIndexAction(formData: FormData) {
  const categoryId = optionalNumberField(formData, "categoryId");
  const filterKind = optionalStringField(formData, "filterKind");
  const filterId = optionalNumberField(formData, "filterId");
  const result = await buildVibixPlayableLinksIndexBatch({
    sourceType: sourceTypeField(formData),
    categoryId,
    filterKind: filterKind === "category" && categoryId ? "category" : filterKind,
    filterId: filterKind === "category" && categoryId ? categoryId : filterId,
    year: optionalNumberField(formData, "year"),
    startPage: numberField(formData, "startPage", 1, 1, 100_000),
    pages: numberField(formData, "pages", 10, 1, 100),
    existKpId: optionalBooleanField(formData, "existKpId") ?? true,
    noAds: optionalBooleanField(formData, "noAds"),
    lgbt: optionalBooleanField(formData, "lgbt"),
    useFields: formData.get("useFields") === "on",
    availableOnly: true,
  });
  redirectWithResult({ ok: result.failed === 0, message: `Playable /links индекс: страниц ${result.scannedPages}, записей ${result.indexed}, новых к догрузке ${result.missingImportable}, ошибок ${result.failed}.`, details: result });
}

export async function importMissingFromVibixAction(formData: FormData) {
  const sourceRaw = formData.get("sourceType");
  const sourceType = sourceRaw === "both" ? "both" : sourceTypeField(formData);
  const categoryId = optionalNumberField(formData, "categoryId");
  const result = await importMissingFromVibixIndex({
    sourceType,
    categoryId,
    limit: numberField(formData, "limit", 50, 1, 200),
  });
  redirectWithResult({ ok: result.failed === 0, message: `Догрузка: импорт ${result.imported}, обновлено ${result.updated}, пропущено ${result.skipped}, detail 404 ${result.detailMissing}, ошибок ${result.failed}.`, details: result });
}

export async function recalculateCatalogKindsAction() {
  const result = await recalculateAllCatalogScores();
  redirectWithResult({ ok: result.errors === 0, message: `Каталог пересчитан: ${result.processed}; публичных ${result.publicVisible}; ошибок ${result.errors}.`, details: result });
}
