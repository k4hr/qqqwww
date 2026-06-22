import { ContentType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getVibixKpIds,
  getVibixReferenceItems,
  getVibixVideoByKpIdResult,
  getVibixVideoLinks,
  type VibixCatalogType,
  type VibixReferenceKind,
} from "@/lib/vibix";
import { saveVibixVideo } from "@/lib/vibix-sync";
import { VIBIX_AUDIT_FILTERS, VIBIX_CATEGORY_IDS, vibixFilterLabel } from "@/lib/vibix-catalog/vibix-taxonomy-ids";

export type CatalogAuditResult = {
  ok: boolean;
  message: string;
  details?: unknown;
};

const REFERENCE_KINDS: VibixReferenceKind[] = ["categories", "genres", "countries", "tags", "voiceovers"];

function playerWhere(): Prisma.MovieWhereInput {
  return {
    OR: [
      { AND: [{ vibixIframeUrl: { not: null } }, { vibixIframeUrl: { not: "" } }] },
      { AND: [{ vibixEmbedCode: { not: null } }, { vibixEmbedCode: { not: "" } }] },
    ],
  };
}

function sourceTypeToContentType(sourceType: string): ContentType {
  return sourceType === "serial" ? ContentType.SERIES : ContentType.MOVIE;
}

function categoryName(categoryId?: number | null) {
  if (!categoryId) return null;
  if (categoryId === VIBIX_CATEGORY_IDS.anime) return "Аниме";
  if (categoryId === VIBIX_CATEGORY_IDS.cartoon) return "Мультфильм";
  if (categoryId === VIBIX_CATEGORY_IDS.adultCartoon) return "Мультфильм для взрослых";
  if (categoryId === VIBIX_CATEGORY_IDS.dorama) return "Дорама";
  if (categoryId === VIBIX_CATEGORY_IDS.lakorn) return "Лакорн";
  if (categoryId === VIBIX_CATEGORY_IDS.mainstream) return "Мейнстрим";
  return null;
}

function filterParams(filterKind?: string | null, filterId?: number | null) {
  if (!filterKind || !filterId) return {};
  if (filterKind === "category") return { categoryIds: [filterId] };
  if (filterKind === "genre") return { genreIds: [filterId] };
  if (filterKind === "tag") return { tagIds: [filterId] };
  if (filterKind === "country") return { countryIds: [filterId] };
  return {};
}

export async function getMyCatalogStats() {
  const [
    total,
    movies,
    series,
    cartoons,
    anime,
    publicVisible,
    popularEligible,
    topEligible,
    homeEligible,
    withPlayer,
    withoutPlayer,
    withoutPoster,
    withKp,
    withoutKp,
    withImdb,
    vibixAvailable,
  ] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { type: ContentType.MOVIE } }),
    prisma.movie.count({ where: { type: ContentType.SERIES } }),
    prisma.movie.count({ where: { type: ContentType.CARTOON } }),
    prisma.movie.count({ where: { type: ContentType.ANIME } }),
    prisma.movie.count({ where: { isPublicVisible: true } }),
    prisma.movie.count({ where: { isPopularEligible: true } }),
    prisma.movie.count({ where: { isTopEligible: true } }),
    prisma.movie.count({ where: { isHomeEligible: true } }),
    prisma.movie.count({ where: playerWhere() }),
    prisma.movie.count({ where: { NOT: playerWhere() } }),
    prisma.movie.count({ where: { OR: [{ posterUrl: null }, { posterUrl: "" }] } }),
    prisma.movie.count({ where: { kinopoiskId: { not: null } } }),
    prisma.movie.count({ where: { OR: [{ kinopoiskId: null }, { kinopoiskId: "" }] } }),
    prisma.movie.count({ where: { imdbId: { not: null } } }),
    prisma.movie.count({ where: { vibixAvailable: true } }),
  ]);

  return {
    total,
    movies,
    series,
    cartoons,
    anime,
    publicVisible,
    popularEligible,
    topEligible,
    homeEligible,
    withPlayer,
    withoutPlayer,
    withoutPoster,
    withKp,
    withoutKp,
    withImdb,
    vibixAvailable,
  };
}

export async function refreshVibixReferences(): Promise<CatalogAuditResult> {
  const result = { updated: 0, failed: 0, errors: [] as string[] };
  for (const kind of REFERENCE_KINDS) {
    const response = await getVibixReferenceItems(kind);
    if (response.requestFailed || response.rateLimited) {
      result.failed += 1;
      result.errors.push(`${kind}: ${response.error?.status ?? "request failed"} ${response.error?.bodyPreview ?? ""}`.slice(0, 500));
      continue;
    }
    for (const item of response.items) {
      await prisma.vibixReferenceItem.upsert({
        where: { kind_vibixId: { kind, vibixId: item.id } },
        create: { kind, vibixId: item.id, name: item.name, nameEng: item.name_eng ?? null, code: item.code ?? null, rawJson: item.raw },
        update: { name: item.name, nameEng: item.name_eng ?? null, code: item.code ?? null, rawJson: item.raw },
      });
      result.updated += 1;
    }
  }
  return { ok: result.failed === 0, message: `Справочники Vibix обновлены: ${result.updated}; ошибок: ${result.failed}.`, details: result };
}

export async function refreshVibixCatalogSnapshots(): Promise<CatalogAuditResult> {
  const result = { updated: 0, failed: 0, errors: [] as string[] };
  for (const filter of VIBIX_AUDIT_FILTERS) {
    const response = await getVibixVideoLinks({
      type: filter.sourceType,
      page: 1,
      limit: 20,
      ...filterParams(filter.filterKind, filter.filterId),
    });
    const key = filter.key;
    if (response.requestFailed || response.rateLimited) {
      await prisma.vibixCatalogSnapshot.upsert({
        where: { key },
        create: {
          key,
          label: filter.label,
          sourceType: filter.sourceType,
          filterKind: filter.filterKind ?? null,
          filterId: filter.filterId ?? null,
          lastCheckedAt: new Date(),
          lastError: response.error ? `HTTP ${response.error.status}: ${response.error.bodyPreview ?? response.error.statusText}`.slice(0, 2_000) : "Request failed",
        },
        update: {
          label: filter.label,
          sourceType: filter.sourceType,
          filterKind: filter.filterKind ?? null,
          filterId: filter.filterId ?? null,
          lastCheckedAt: new Date(),
          lastError: response.error ? `HTTP ${response.error.status}: ${response.error.bodyPreview ?? response.error.statusText}`.slice(0, 2_000) : "Request failed",
        },
      });
      result.failed += 1;
      result.errors.push(`${filter.label}: ${response.error?.status ?? "request failed"}`);
      continue;
    }

    await prisma.vibixCatalogSnapshot.upsert({
      where: { key },
      create: {
        key,
        label: filter.label,
        sourceType: filter.sourceType,
        filterKind: filter.filterKind ?? null,
        filterId: filter.filterId ?? null,
        total: response.meta?.total ?? response.data.length,
        lastPage: response.meta?.lastPage ?? null,
        perPage: response.meta?.perPage ?? null,
        lastCheckedAt: new Date(),
        lastError: null,
      },
      update: {
        label: filter.label,
        sourceType: filter.sourceType,
        filterKind: filter.filterKind ?? null,
        filterId: filter.filterId ?? null,
        total: response.meta?.total ?? response.data.length,
        lastPage: response.meta?.lastPage ?? null,
        perPage: response.meta?.perPage ?? null,
        lastCheckedAt: new Date(),
        lastError: null,
      },
    });
    result.updated += 1;
  }
  return { ok: result.failed === 0, message: `Статистика Vibix обновлена: ${result.updated}; ошибок: ${result.failed}.`, details: result };
}

export async function refreshVibixCatalogAudit() {
  const references = await refreshVibixReferences();
  const snapshots = await refreshVibixCatalogSnapshots();
  return { ok: references.ok && snapshots.ok, message: `${references.message} ${snapshots.message}`, details: { references, snapshots } };
}

export async function buildVibixCatalogIndexBatch(options: {
  sourceType: VibixCatalogType;
  categoryId?: number | null;
  startPage?: number;
  pages?: number;
  limit?: number;
}) {
  const sourceType = options.sourceType;
  const categoryId = options.categoryId ?? null;
  const category = categoryName(categoryId);
  const startPage = Math.max(1, Math.trunc(options.startPage ?? 1));
  const pages = Math.max(1, Math.min(50, Math.trunc(options.pages ?? 5)));
  const limit = Math.max(100, Math.min(1000, Math.trunc(options.limit ?? 1000)));
  const result = { sourceType, categoryId, startPage, pages, limit, scannedPages: 0, indexed: 0, emptyPages: 0, failed: 0, errors: [] as string[] };

  for (let page = startPage; page < startPage + pages; page += 1) {
    const response = await getVibixKpIds({ type: sourceType, page, limit, categoryIds: categoryId ? [categoryId] : undefined });
    if (response.requestFailed || response.rateLimited) {
      result.failed += 1;
      result.errors.push(`page ${page}: ${response.error?.status ?? "request failed"} ${response.error?.bodyPreview ?? ""}`.slice(0, 500));
      break;
    }
    result.scannedPages += 1;
    if (!response.kpIds.length) {
      result.emptyPages += 1;
      break;
    }

    const existingKp = new Set((await prisma.movie.findMany({
      where: { kinopoiskId: { in: response.kpIds.map(String) } },
      select: { id: true, kinopoiskId: true },
    })).map((movie) => movie.kinopoiskId).filter(Boolean) as string[]);

    for (const kpId of response.kpIds) {
      const kp = String(kpId);
      await prisma.vibixCatalogIndex.upsert({
        where: { sourceType_kpId: { sourceType, kpId: kp } },
        create: {
          sourceType,
          kpId: kp,
          categoryId,
          categoryName: category,
          sourcePage: page,
          importStatus: existingKp.has(kp) ? "PRESENT" : "MISSING",
          lastSeenAt: new Date(),
        },
        update: {
          categoryId,
          categoryName: category,
          sourcePage: page,
          importStatus: existingKp.has(kp) ? "PRESENT" : "MISSING",
          lastSeenAt: new Date(),
        },
      });
      result.indexed += 1;
    }
  }

  return result;
}

export async function importMissingFromVibixIndex(options: {
  sourceType?: VibixCatalogType | "both";
  categoryId?: number | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, Math.trunc(options.limit ?? 50)));
  const sourceType = options.sourceType ?? "both";
  const where: Prisma.VibixCatalogIndexWhereInput = {
    importStatus: { in: ["MISSING", "UNKNOWN", "FAILED"] },
    ...(sourceType === "both" ? {} : { sourceType }),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
  };
  const rows = await prisma.vibixCatalogIndex.findMany({ where, orderBy: [{ updatedAt: "asc" }], take: limit });
  const result = { requested: rows.length, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const existing = await prisma.movie.findFirst({ where: { kinopoiskId: row.kpId }, select: { id: true } });
      if (existing) {
        await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "PRESENT", importedMovieId: existing.id, importedAt: new Date(), lastImportError: null } });
        result.skipped += 1;
        continue;
      }

      const lookup = await getVibixVideoByKpIdResult(row.kpId);
      if (lookup.rateLimited || lookup.requestFailed || !lookup.video) {
        const message = lookup.error ? `HTTP ${lookup.error.status}: ${lookup.error.bodyPreview ?? lookup.error.statusText}` : "Vibix detail missing";
        await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "FAILED", lastImportError: message.slice(0, 2_000) } });
        result.failed += 1;
        result.errors.push(`${row.kpId}: ${message}`.slice(0, 500));
        continue;
      }

      const enrichedVideo = { ...lookup.video, category_id: row.categoryId } as Parameters<typeof saveVibixVideo>[0];
      const saved = await saveVibixVideo(enrichedVideo);
      if (saved.status === "imported") result.imported += 1;
      else if (saved.status === "updated") result.updated += 1;
      else result.skipped += 1;
      await prisma.vibixCatalogIndex.update({
        where: { id: row.id },
        data: {
          importStatus: saved.status === "skipped" ? "SKIPPED" : "IMPORTED",
          importedMovieId: "movieId" in saved ? saved.movieId : null,
          importedAt: new Date(),
          lastImportError: saved.status === "skipped" ? saved.reason : null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "FAILED", lastImportError: message.slice(0, 2_000) } });
      result.failed += 1;
      result.errors.push(`${row.kpId}: ${message}`.slice(0, 500));
    }
  }

  return result;
}

export async function getVibixCatalogDashboardData() {
  const [my, snapshots, refs, indexTotal, indexMissing, indexPresent, indexImported, indexFailed, missingPreview] = await Promise.all([
    getMyCatalogStats(),
    prisma.vibixCatalogSnapshot.findMany({ orderBy: [{ sourceType: "asc" }, { key: "asc" }] }),
    prisma.vibixReferenceItem.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.vibixCatalogIndex.count(),
    prisma.vibixCatalogIndex.count({ where: { importStatus: { in: ["MISSING", "UNKNOWN", "FAILED"] } } }),
    prisma.vibixCatalogIndex.count({ where: { importStatus: "PRESENT" } }),
    prisma.vibixCatalogIndex.count({ where: { importStatus: "IMPORTED" } }),
    prisma.vibixCatalogIndex.count({ where: { importStatus: "FAILED" } }),
    prisma.vibixCatalogIndex.findMany({
      where: { importStatus: { in: ["MISSING", "UNKNOWN", "FAILED"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    }),
  ]);

  const referenceCounts = Object.fromEntries(refs.map((item) => [item.kind, item._count._all]));

  return {
    my,
    snapshots,
    referenceCounts,
    index: { total: indexTotal, missing: indexMissing, present: indexPresent, imported: indexImported, failed: indexFailed, missingPreview },
    suggestedCategoryIds: VIBIX_CATEGORY_IDS,
    suggestedFilters: VIBIX_AUDIT_FILTERS.map((item) => ({ ...item, filterLabel: vibixFilterLabel(item.filterKind, item.filterId) })),
  };
}
