import { ContentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getVibixKpIds,
  getVibixReferenceItems,
  getVibixVideoByImdbIdResult,
  getVibixVideoByKpIdResult,
  getVibixVideoByVibixIdResult,
  getVibixVideoLinks,
  sleep,
  VIBIX_LINK_FIELDS,
  type VibixCatalogType,
  type VibixReferenceKind,
  type VibixVideo,
} from "@/lib/vibix";
import { saveVibixVideo } from "@/lib/vibix-sync";
import { VIBIX_AUDIT_FILTERS, VIBIX_CATEGORY_IDS, vibixFilterLabel } from "@/lib/vibix-catalog/vibix-taxonomy-ids";

export type CatalogAuditResult = {
  ok: boolean;
  message: string;
  details?: unknown;
};

const REFERENCE_KINDS: VibixReferenceKind[] = ["categories", "genres", "countries", "tags", "voiceovers"];

const SUSPICIOUS_FULL_CATALOG_TOTAL = envInt("VIBIX_SUSPICIOUS_FULL_CATALOG_TOTAL", 100_000, 10_000, 5_000_000);
const AVAILABLE_INDEX_HARD_CAP = envInt("VIBIX_AVAILABLE_INDEX_HARD_CAP", 35_000, 5_000, 200_000);

function envInt(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function isSuspiciousFullCatalogSnapshot(total?: number | null, lastPage?: number | null) {
  return Boolean((total ?? 0) >= SUSPICIOUS_FULL_CATALOG_TOTAL || (lastPage ?? 0) >= Math.ceil(SUSPICIOUS_FULL_CATALOG_TOTAL / 50));
}

function hasAvailableLinkFilter(options: { existKpId?: boolean | null; categoryId?: number | null; filterKind?: string | null; filterId?: number | null; year?: number | null }) {
  return options.existKpId === true || Boolean(options.categoryId || options.filterId || options.year || process.env.VIBIX_LINKS_AVAILABLE_QUERY?.trim());
}

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


function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function fromPrismaJson<T = Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== "object") return null;
  return JSON.parse(JSON.stringify(value)) as T;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function intValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function videoKpId(video: Record<string, unknown>) {
  return stringValue(video.kp_id ?? video.kinopoisk_id ?? video.kpId ?? video.kinopoiskId);
}

function videoImdbId(video: Record<string, unknown>) {
  return stringValue(video.imdb_id ?? video.imdbId);
}

function videoTitle(video: Record<string, unknown>) {
  return stringValue(video.name_rus ?? video.name ?? video.name_eng ?? video.name_original);
}

function videoHasPlayer(video: Record<string, unknown>) {
  return Boolean(stringValue(video.iframe_url ?? video.iframeUrl) || stringValue(video.embed_code ?? video.embedCode));
}

function isRealKpId(value: string | null | undefined) {
  return Boolean(value && /^\d+$/.test(value));
}

function syntheticIndexKey(sourceType: string, video: Record<string, unknown>) {
  const realKpId = videoKpId(video);
  if (realKpId) return { key: realKpId, realKpId };
  const vibixId = intValue(video.id);
  if (vibixId !== null) return { key: `vibix:${sourceType}:${vibixId}`, realKpId: null };
  const imdbId = videoImdbId(video);
  if (imdbId) return { key: `imdb:${sourceType}:${imdbId}`, realKpId: null };
  const title = videoTitle(video);
  const year = intValue(video.year);
  if (title && year) return { key: `title:${sourceType}:${title.toLocaleLowerCase("ru-RU")}:${year}`, realKpId: null };
  return null;
}

function boolParam(value: boolean | null | undefined) {
  return value === true || value === false ? value : undefined;
}

function filterParams(filterKind?: string | null, filterId?: number | null) {
  if (!filterKind || !filterId) return {};
  if (filterKind === "category") return { categoryIds: [filterId] };
  if (filterKind === "genre") return { genreIds: [filterId] };
  if (filterKind === "tag") return { tagIds: [filterId] };
  if (filterKind === "country") return { countryIds: [filterId] };
  return {};
}

type VibixAuditFilter = (typeof VIBIX_AUDIT_FILTERS)[number];

function getAuditFilterKind(filter: VibixAuditFilter): string | null {
  return "filterKind" in filter ? filter.filterKind : null;
}

function getAuditFilterId(filter: VibixAuditFilter): number | null {
  return "filterId" in filter ? filter.filterId : null;
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
        create: { kind, vibixId: item.id, name: item.name, nameEng: item.name_eng ?? null, code: item.code ?? null, rawJson: toPrismaJson(item.raw) },
        update: { name: item.name, nameEng: item.name_eng ?? null, code: item.code ?? null, rawJson: toPrismaJson(item.raw) },
      });
      result.updated += 1;
    }
  }
  return { ok: result.failed === 0, message: `Справочники Vibix обновлены: ${result.updated}; ошибок: ${result.failed}.`, details: result };
}

export async function refreshVibixCatalogSnapshots(): Promise<CatalogAuditResult> {
  const result = { updated: 0, failed: 0, errors: [] as string[] };
  for (const filter of VIBIX_AUDIT_FILTERS) {
    const filterKind = getAuditFilterKind(filter);
    const filterId = getAuditFilterId(filter);
    const response = await getVibixVideoLinks({
      type: filter.sourceType,
      page: 1,
      limit: 20,
      ...filterParams(filterKind, filterId),
    });
    const key = filter.key;
    if (response.requestFailed || response.rateLimited) {
      await prisma.vibixCatalogSnapshot.upsert({
        where: { key },
        create: {
          key,
          label: filter.label,
          sourceType: filter.sourceType,
          filterKind,
          filterId,
          lastCheckedAt: new Date(),
          lastError: response.error ? `HTTP ${response.error.status}: ${response.error.bodyPreview ?? response.error.statusText}`.slice(0, 2_000) : "Request failed",
        },
        update: {
          label: filter.label,
          sourceType: filter.sourceType,
          filterKind,
          filterId,
          lastCheckedAt: new Date(),
          lastError: response.error ? `HTTP ${response.error.status}: ${response.error.bodyPreview ?? response.error.statusText}`.slice(0, 2_000) : "Request failed",
        },
      });
      result.failed += 1;
      result.errors.push(`${filter.label}: ${response.error?.status ?? "request failed"}`);
      continue;
    }

    const total = response.meta?.total ?? response.data.length;
    const lastPage = response.meta?.lastPage ?? null;
    const perPage = response.meta?.perPage ?? null;
    const suspicious = isSuspiciousFullCatalogSnapshot(total, lastPage);

    await prisma.vibixCatalogSnapshot.upsert({
      where: { key },
      create: {
        key,
        label: filter.label,
        sourceType: filter.sourceType,
        filterKind,
        filterId,
        total,
        lastPage,
        perPage,
        lastCheckedAt: new Date(),
        lastError: null,
      },
      update: {
        label: filter.label,
        sourceType: filter.sourceType,
        filterKind,
        filterId,
        total,
        lastPage,
        perPage,
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
  const result = { sourceType, categoryId, startPage, pages, limit, scannedPages: 0, indexed: 0, present: 0, rawOnly: 0, emptyPages: 0, failed: 0, errors: [] as string[] };

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

    const kpStrings = response.kpIds.map(String);
    const existingKp = new Map((await prisma.movie.findMany({
      where: { kinopoiskId: { in: kpStrings } },
      select: { id: true, kinopoiskId: true },
    })).flatMap((movie) => movie.kinopoiskId ? [[movie.kinopoiskId, movie.id] as const] : []));

    for (const kpId of response.kpIds) {
      const kp = String(kpId);
      const existingMovieId = existingKp.get(kp) ?? null;
      const status = existingMovieId ? "PRESENT" : "RAW_KPID";
      await prisma.vibixCatalogIndex.upsert({
        where: { sourceType_kpId: { sourceType, kpId: kp } },
        create: {
          sourceType,
          kpId: kp,
          categoryId,
          categoryName: category,
          sourcePage: page,
          indexSource: "kpids",
          importStatus: status,
          importedMovieId: existingMovieId,
          lastSeenAt: new Date(),
        },
        update: {
          categoryId,
          categoryName: category,
          sourcePage: page,
          indexSource: "kpids",
          importStatus: status,
          importedMovieId: existingMovieId,
          lastSeenAt: new Date(),
          lastImportError: status === "PRESENT" ? null : undefined,
        },
      });
      result.indexed += 1;
      if (existingMovieId) result.present += 1;
      else result.rawOnly += 1;
    }
  }

  return result;
}

export async function buildVibixPlayableLinksIndexBatch(options: {
  sourceType: VibixCatalogType;
  categoryId?: number | null;
  filterKind?: string | null;
  filterId?: number | null;
  year?: number | null;
  startPage?: number;
  pages?: number;
  limit?: number;
  existKpId?: boolean | null;
  noAds?: boolean | null;
  lgbt?: boolean | null;
  useFields?: boolean;
  pageDelayMs?: number;
  availableOnly?: boolean;
}) {
  const sourceType = options.sourceType;
  const categoryId = options.categoryId ?? (options.filterKind === "category" ? options.filterId ?? null : null);
  const filterKind = options.filterKind ?? (categoryId ? "category" : null);
  const filterId = options.filterId ?? categoryId;
  const category = categoryName(categoryId);
  const startPage = Math.max(1, Math.trunc(options.startPage ?? 1));
  const pages = Math.max(1, Math.min(100, Math.trunc(options.pages ?? 10)));
  const limit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 50)));
  const result = {
    sourceType,
    categoryId,
    filterKind,
    filterId,
    startPage,
    pages,
    scannedPages: 0,
    indexed: 0,
    present: 0,
    missingImportable: 0,
    skippedNoIdentifier: 0,
    emptyPages: 0,
    fieldFallbacks: 0,
    existKpFallbacks: 0,
    rateLimited: false,
    retryAfterMs: null as number | null,
    stoppedAtPage: null as number | null,
    failed: 0,
    errors: [] as string[],
  };

  const effectiveExistKpId = options.existKpId ?? true;
  const availableOnly = options.availableOnly ?? true;
  const guarded = hasAvailableLinkFilter({
    existKpId: effectiveExistKpId,
    categoryId,
    filterKind,
    filterId,
    year: options.year ?? null,
  });
  const baseParams = {
    type: sourceType,
    limit,
    year: options.year ?? undefined,
    ...filterParams(filterKind, filterId),
    noAds: boolParam(options.noAds),
    lgbt: boolParam(options.lgbt),
    availableOnly,
  };

  for (let page = startPage; page < startPage + pages; page += 1) {
    let response = await getVibixVideoLinks({
      ...baseParams,
      page,
      existKpId: effectiveExistKpId,
      fields: options.useFields === true ? VIBIX_LINK_FIELDS : undefined,
    });

    // Vibix иногда падает HTTP 500 именно от fields[]. Для полного индекса безопаснее
    // потерять выборку полей, чем остановить весь импорт.
    if ((response.requestFailed || response.rateLimited) && options.useFields === true) {
      const status = response.error?.status ?? null;
      if (status === null || status >= 500) {
        const fallback = await getVibixVideoLinks({
          ...baseParams,
          page,
          existKpId: effectiveExistKpId,
          fields: undefined,
        });
        if (!fallback.requestFailed && !fallback.rateLimited) {
          response = fallback;
          result.fieldFallbacks += 1;
        }
      }
    }

    // Если общий /links у Vibix падает на тяжёлой странице, пробуем облегчённый вариант
    // только с kpId. Он не заменяет полный индекс, но даёт продолжить покрытие.
    if ((response.requestFailed || response.rateLimited) && (options.existKpId === null || options.existKpId === undefined)) {
      const status = response.error?.status ?? null;
      if (status === null || status >= 500) {
        const fallback = await getVibixVideoLinks({
          ...baseParams,
          page,
          existKpId: true,
          fields: undefined,
        });
        if (!fallback.requestFailed && !fallback.rateLimited) {
          response = fallback;
          result.existKpFallbacks += 1;
        }
      }
    }

    if (!response.requestFailed && !response.rateLimited) {
      const total = response.meta?.total ?? null;
      const lastPage = response.meta?.lastPage ?? null;
      if (!guarded && isSuspiciousFullCatalogSnapshot(total, lastPage)) {
        result.failed += 1;
        result.stoppedAtPage = page;
        result.errors.push(`links page ${page}: suspicious full Vibix catalog total=${total ?? "unknown"}, lastPage=${lastPage ?? "unknown"}. Нужно сканировать только available/in-stock слой, а не общий миллионный каталог.`);
        break;
      }
    }

    if (response.requestFailed || response.rateLimited) {
      result.failed += 1;
      result.rateLimited = Boolean(response.rateLimited || response.error?.status === 429);
      result.retryAfterMs = response.retryAfterMs;
      result.stoppedAtPage = page;
      result.errors.push(`links page ${page}: ${response.error?.status ?? "request failed"} ${response.error?.bodyPreview ?? ""}`.slice(0, 500));
      break;
    }
    result.scannedPages += 1;
    if (!response.data.length) {
      result.emptyPages += 1;
      result.stoppedAtPage = page;
      break;
    }

    const normalizedRows = response.data.flatMap((video) => {
      const raw = video as unknown as Record<string, unknown>;
      const key = syntheticIndexKey(sourceType, raw);
      if (!key) return [];
      return [{ raw, identityKey: key.key, realKpId: key.realKpId, imdbId: videoImdbId(raw), vibixId: intValue(raw.id) }];
    });
    result.skippedNoIdentifier += response.data.length - normalizedRows.length;

    const realKpIds = normalizedRows.map((item) => item.realKpId).filter((value): value is string => Boolean(value));
    const imdbIds = normalizedRows.map((item) => item.imdbId).filter((value): value is string => Boolean(value));
    const vibixIds = normalizedRows.map((item) => item.vibixId).filter((value): value is number => value !== null);

    const existingByKp = new Map((await prisma.movie.findMany({
      where: realKpIds.length ? { kinopoiskId: { in: realKpIds } } : { id: "__none__" },
      select: { id: true, kinopoiskId: true },
    })).flatMap((movie) => movie.kinopoiskId ? [[movie.kinopoiskId, movie.id] as const] : []));
    const existingByImdb = new Map((await prisma.movie.findMany({
      where: imdbIds.length ? { imdbId: { in: imdbIds } } : { id: "__none__" },
      select: { id: true, imdbId: true },
    })).flatMap((movie) => movie.imdbId ? [[movie.imdbId, movie.id] as const] : []));
    const existingByVibix = new Map((await prisma.movie.findMany({
      where: vibixIds.length ? { vibixId: { in: vibixIds } } : { id: "__none__" },
      select: { id: true, vibixId: true },
    })).flatMap((movie) => movie.vibixId !== null ? [[movie.vibixId, movie.id] as const] : []));

    for (const item of normalizedRows) {
      const existingMovieId = (item.realKpId ? existingByKp.get(item.realKpId) : null)
        ?? (item.imdbId ? existingByImdb.get(item.imdbId) : null)
        ?? (item.vibixId !== null ? existingByVibix.get(item.vibixId) : null)
        ?? null;
      const status = existingMovieId ? "PRESENT" : "MISSING";
      const hasPlayer = videoHasPlayer(item.raw);
      await prisma.vibixCatalogIndex.upsert({
        where: { sourceType_kpId: { sourceType, kpId: item.identityKey } },
        create: {
          sourceType,
          kpId: item.identityKey,
          categoryId,
          categoryName: category,
          sourcePage: page,
          indexSource: "links",
          vibixId: item.vibixId,
          imdbId: item.imdbId,
          title: videoTitle(item.raw),
          year: intValue(item.raw.year),
          hasPlayableLink: hasPlayer,
          detailAvailable: true,
          detailCheckedAt: new Date(),
          rawJson: toPrismaJson(item.raw),
          importStatus: status,
          importedMovieId: existingMovieId,
          lastSeenAt: new Date(),
          lastImportError: null,
        },
        update: {
          categoryId,
          categoryName: category,
          sourcePage: page,
          indexSource: "links",
          vibixId: item.vibixId,
          imdbId: item.imdbId,
          title: videoTitle(item.raw),
          year: intValue(item.raw.year),
          hasPlayableLink: hasPlayer,
          detailAvailable: true,
          detailCheckedAt: new Date(),
          rawJson: toPrismaJson(item.raw),
          importStatus: status,
          importedMovieId: existingMovieId,
          lastSeenAt: new Date(),
          lastImportError: null,
        },
      });
      result.indexed += 1;
      if (existingMovieId) result.present += 1;
      else result.missingImportable += 1;
    }

    const indexedTotal = await prisma.vibixCatalogIndex.count({ where: { indexSource: "links" } });
    if (indexedTotal >= AVAILABLE_INDEX_HARD_CAP) {
      result.emptyPages += 1;
      result.stoppedAtPage = page;
      result.errors.push(`Достигнут безопасный лимит available-index ${AVAILABLE_INDEX_HARD_CAP}; останавливаю /links scan, чтобы не уйти в общий миллионный каталог.`);
      break;
    }

    if (options.pageDelayMs && options.pageDelayMs > 0 && page < startPage + pages - 1) {
      await sleep(Math.min(30_000, Math.max(250, Math.trunc(options.pageDelayMs))));
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
    importStatus: "MISSING",
    indexSource: "links",
    ...(sourceType === "both" ? {} : { sourceType }),
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
  };
  const rows = await prisma.vibixCatalogIndex.findMany({ where, orderBy: [{ updatedAt: "asc" }], take: limit });
  const result = { requested: rows.length, imported: 0, updated: 0, skipped: 0, detailMissing: 0, failed: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const existingConditions: Prisma.MovieWhereInput[] = [
        ...(isRealKpId(row.kpId) ? [{ kinopoiskId: row.kpId }] : []),
        ...(row.imdbId ? [{ imdbId: row.imdbId }] : []),
        ...(row.vibixId !== null ? [{ vibixId: row.vibixId }] : []),
      ];
      const existing = existingConditions.length
        ? await prisma.movie.findFirst({ where: { OR: existingConditions }, select: { id: true } })
        : null;
      if (existing) {
        await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "PRESENT", importedMovieId: existing.id, importedAt: new Date(), lastImportError: null } });
        result.skipped += 1;
        continue;
      }

      let videoToSave = fromPrismaJson<Parameters<typeof saveVibixVideo>[0]>(row.rawJson);
      let lookup: Awaited<ReturnType<typeof getVibixVideoByKpIdResult>> | Awaited<ReturnType<typeof getVibixVideoByImdbIdResult>> | null = null;

      // /links may contain Vibix API id but not the exact Rendex embed_code.
      // API id is not always the player data-id, especially for serials.
      // If raw /links has no iframe_url/embed_code, fetch detail by KP/IMDb and use
      // the exact embed_code returned by Vibix.
      if ((!videoToSave || !videoHasPlayer(videoToSave as unknown as Record<string, unknown>)) && isRealKpId(row.kpId)) {
        lookup = await getVibixVideoByKpIdResult(row.kpId);
        if (lookup.video) videoToSave = lookup.video as Parameters<typeof saveVibixVideo>[0];
      }
      if ((!videoToSave || !videoHasPlayer(videoToSave as unknown as Record<string, unknown>)) && row.imdbId) {
        const imdbLookup = await getVibixVideoByImdbIdResult(row.imdbId);
        if (imdbLookup.video) {
          lookup = imdbLookup;
          videoToSave = imdbLookup.video as Parameters<typeof saveVibixVideo>[0];
        } else if (!lookup) {
          lookup = imdbLookup;
        }
      }
      if (videoToSave && !videoHasPlayer(videoToSave as unknown as Record<string, unknown>)) {
        const message = "Skipped: Vibix detail has no iframe_url/embed_code player source.";
        await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "SKIP_NO_PLAYER", detailCheckedAt: new Date(), detailAvailable: false, lastImportError: message } });
        result.skipped += 1;
        continue;
      }
      if (videoToSave) videoToSave = { ...videoToSave, category_id: row.categoryId } as Parameters<typeof saveVibixVideo>[0];

      if (lookup?.rateLimited || lookup?.requestFailed) {
        const status = lookup.error?.status ?? null;
        if (status && status !== 404) {
          const message = lookup.error ? `HTTP ${lookup.error.status}: ${lookup.error.bodyPreview ?? lookup.error.statusText}` : "Vibix request failed";
          await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "FAILED", detailCheckedAt: new Date(), detailAvailable: false, lastImportError: message.slice(0, 2_000) } });
          result.failed += 1;
          result.errors.push(`${row.kpId}: ${message}`.slice(0, 500));
          continue;
        }
      }

      if (!videoToSave) {
        const message = "Vibix detail missing; raw /links data is not available. Rebuild playable /links index for this type/category.";
        await prisma.vibixCatalogIndex.update({ where: { id: row.id }, data: { importStatus: "DETAIL_MISSING", detailCheckedAt: new Date(), detailAvailable: false, lastImportError: message } });
        result.detailMissing += 1;
        continue;
      }

      const saved = await saveVibixVideo(videoToSave);
      if (saved.status === "imported") result.imported += 1;
      else if (saved.status === "updated") result.updated += 1;
      else result.skipped += 1;
      await prisma.vibixCatalogIndex.update({
        where: { id: row.id },
        data: {
          importStatus: saved.status === "skipped" ? "SKIPPED" : "IMPORTED",
          importedMovieId: "movieId" in saved ? saved.movieId : null,
          importedAt: new Date(),
          detailCheckedAt: new Date(),
          detailAvailable: Boolean(lookup?.video || row.rawJson),
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


export async function hideMoviesWithoutVibixPlayer(options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(50_000, Math.trunc(options.limit ?? 10_000)));
  const rows = await prisma.movie.findMany({
    where: {
      AND: [
        { OR: [{ vibixAvailable: false }, { NOT: playerWhere() }] },
        { OR: [{ isPublished: true }, { isCatalogAllowed: true }, { isPublicVisible: true }, { vibixAvailable: true }] },
      ],
    },
    select: { id: true },
    take: limit,
  });

  if (!rows.length) return { scanned: 0, hidden: 0, message: "Карточек без Vibix-плеера в публичном каталоге не найдено." };

  const ids = rows.map((item) => item.id);
  const updated = await prisma.movie.updateMany({
    where: { id: { in: ids } },
    data: {
      isPublished: false,
      isCatalogAllowed: false,
      isPublicVisible: false,
      isHomeEligible: false,
      isHeroEligible: false,
      isTrendingEligible: false,
      isPopularEligible: false,
      isTopEligible: false,
      isFreshEligible: false,
      vibixAvailable: false,
      catalogBlockReason: "NO_VIBIX_PLAYER",
      catalogCheckedAt: new Date(),
    },
  });

  return { scanned: rows.length, hidden: updated.count, message: `Скрыто карточек без Vibix-плеера: ${updated.count}.` };
}


type CoverageRepairStatus =
  | "VERIFIED_OK"
  | "AUTO_REPAIRED"
  | "SKIP_LOW_VALUE"
  | "MISSING_IMPORTABLE"
  | "HIDDEN_LOCAL"
  | "NEEDS_PLAYER_REPAIR"
  | "NEEDS_TYPE_REPAIR"
  | "FAILED";

const COVERAGE_FINAL_STATUSES = ["VERIFIED_OK", "AUTO_REPAIRED", "SKIP_LOW_VALUE"];
const COVERAGE_ACTION_STATUSES = ["MISSING", "PRESENT", "IMPORTED", "SKIPPED", "FAILED", "DETAIL_MISSING", "RAW_KPID", "UNKNOWN"];

function numberFromRaw(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasUsableRawForRepair(raw: Record<string, unknown> | null) {
  if (!raw) return false;
  return Boolean(videoTitle(raw) && intValue(raw.year) && videoHasPlayer(raw));
}

function isImportantVibixRow(raw: Record<string, unknown> | null) {
  if (!raw) return false;
  const rating = Math.max(numberFromRaw(raw.kp_rating), numberFromRaw(raw.imdb_rating));
  const votes = Math.max(numberFromRaw(raw.kp_votes), numberFromRaw(raw.imdb_votes));
  const title = `${videoTitle(raw) ?? ""} ${stringValue(raw.name_eng) ?? ""} ${stringValue(raw.name_original) ?? ""}`.toLocaleLowerCase("ru-RU");
  const genreText = Array.isArray(raw.genre) ? raw.genre.join(" ").toLocaleLowerCase("ru-RU") : stringValue(raw.genre)?.toLocaleLowerCase("ru-RU") ?? "";
  const franchiseMarkers = ["game of thrones", "игра престолов", "walking dead", "ходяч", "from", "извне", "interstellar", "интерстеллар", "marvel", "мстител", "harry potter", "гарри поттер", "lord of the rings", "властелин колец"];
  const massGenre = ["боевик", "триллер", "драма", "фэнтези", "фантастика", "приключения", "криминал", "комедия", "action", "thriller", "drama", "fantasy", "adventure", "crime"].some((marker) => genreText.includes(marker));
  const franchise = franchiseMarkers.some((marker) => title.includes(marker));
  return franchise || votes >= 2_000 || (votes >= 100 && rating >= 6.6) || rating >= 7.4 || massGenre;
}

function expectedContentTypeFromRow(sourceType: string, raw: Record<string, unknown> | null) {
  const typeText = stringValue(raw?.type)?.toLowerCase() ?? sourceType.toLowerCase();
  if (["serial", "series", "tv", "show", "tv_series", "tv series"].includes(typeText)) return ContentType.SERIES;
  return ContentType.MOVIE;
}

async function findExactLocalMovieForIndex(row: {
  kpId: string;
  imdbId: string | null;
  vibixId: number | null;
  title: string | null;
  year: number | null;
}, raw: Record<string, unknown> | null) {
  const or: Prisma.MovieWhereInput[] = [];
  const kpId = videoKpId(raw ?? {}) ?? (isRealKpId(row.kpId) ? row.kpId : null);
  const imdbId = videoImdbId(raw ?? {}) ?? row.imdbId;
  const vibixId = intValue(raw?.id) ?? row.vibixId;
  if (kpId) or.push({ kinopoiskId: kpId });
  if (imdbId) or.push({ imdbId });
  if (vibixId !== null) or.push({ vibixId });

  if (or.length) {
    return prisma.movie.findFirst({
      where: { OR: or },
      include: { genres: { include: { genre: true } } },
      orderBy: [{ vibixAvailable: "desc" }, { isPublicVisible: "desc" }, { updatedAt: "desc" }],
    });
  }

  const title = videoTitle(raw ?? {}) ?? row.title;
  const year = intValue(raw?.year) ?? row.year;
  if (!title || !year) return null;
  return prisma.movie.findFirst({
    where: { titleRu: { equals: title, mode: "insensitive" }, year },
    include: { genres: { include: { genre: true } } },
    orderBy: [{ vibixAvailable: "desc" }, { isPublicVisible: "desc" }, { updatedAt: "desc" }],
  });
}

function needsCoverageRepair(movie: Awaited<ReturnType<typeof findExactLocalMovieForIndex>>, sourceType: string, raw: Record<string, unknown> | null) {
  if (!movie) return { needed: true, reason: "MISSING_IMPORTABLE" as CoverageRepairStatus };
  const hasPlayer = Boolean(stringValue(movie.vibixIframeUrl) || stringValue(movie.vibixEmbedCode));
  if (!hasPlayer && videoHasPlayer(raw ?? {})) return { needed: true, reason: "NEEDS_PLAYER_REPAIR" as CoverageRepairStatus };
  const expectedType = expectedContentTypeFromRow(sourceType, raw);
  if (movie.type !== expectedType) return { needed: true, reason: "NEEDS_TYPE_REPAIR" as CoverageRepairStatus };
  if (!movie.isPublicVisible && isImportantVibixRow(raw)) return { needed: true, reason: "HIDDEN_LOCAL" as CoverageRepairStatus };
  return { needed: false, reason: "VERIFIED_OK" as CoverageRepairStatus };
}

export async function verifyAndRepairImportantVibixCoverage(options: { limit?: number } = {}) {
  const limit = Math.max(10, Math.min(300, Math.trunc(options.limit ?? 100)));
  const rows = await prisma.vibixCatalogIndex.findMany({
    where: {
      indexSource: "links",
      importStatus: { in: COVERAGE_ACTION_STATUSES },
      rawJson: { not: Prisma.JsonNull },
    },
    orderBy: [
      { importStatus: "asc" },
      { sourcePage: "asc" },
      { updatedAt: "asc" },
    ],
    take: limit,
  });

  const result = {
    requested: rows.length,
    verified: 0,
    imported: 0,
    updated: 0,
    repaired: 0,
    lowValue: 0,
    hiddenLocal: 0,
    playerRepair: 0,
    typeRepair: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const row of rows) {
    try {
      const raw = fromPrismaJson<Record<string, unknown>>(row.rawJson);
      const exactLocal = await findExactLocalMovieForIndex(row, raw);
      const repair = needsCoverageRepair(exactLocal, row.sourceType, raw);

      if (!repair.needed) {
        await prisma.vibixCatalogIndex.update({
          where: { id: row.id },
          data: {
            importStatus: "VERIFIED_OK",
            importedMovieId: exactLocal?.id ?? row.importedMovieId,
            importedAt: row.importedAt ?? new Date(),
            lastImportError: null,
          },
        });
        result.verified += 1;
        continue;
      }

      if (!hasUsableRawForRepair(raw) || !isImportantVibixRow(raw)) {
        await prisma.vibixCatalogIndex.update({
          where: { id: row.id },
          data: {
            importStatus: "SKIP_LOW_VALUE",
            importedMovieId: exactLocal?.id ?? row.importedMovieId,
            lastImportError: repair.reason,
          },
        });
        result.lowValue += 1;
        continue;
      }

      const videoToSave = { ...(raw as Record<string, unknown>), category_id: row.categoryId } as unknown as Parameters<typeof saveVibixVideo>[0];
      const saved = await saveVibixVideo(videoToSave, exactLocal?.id);
      const movieId = "movieId" in saved ? saved.movieId : exactLocal?.id ?? null;

      if (saved.status === "skipped") {
        await prisma.vibixCatalogIndex.update({
          where: { id: row.id },
          data: {
            importStatus: repair.reason,
            importedMovieId: movieId,
            lastImportError: saved.reason,
          },
        });
        result.failed += 1;
        result.errors.push(`${row.kpId}: ${repair.reason}: ${saved.reason}`.slice(0, 500));
        continue;
      }

      await prisma.vibixCatalogIndex.update({
        where: { id: row.id },
        data: {
          importStatus: "AUTO_REPAIRED",
          importedMovieId: movieId,
          importedAt: new Date(),
          detailAvailable: true,
          detailCheckedAt: new Date(),
          lastImportError: repair.reason,
        },
      });

      if (saved.status === "imported") result.imported += 1;
      else result.updated += 1;
      result.repaired += 1;
      if (repair.reason === "HIDDEN_LOCAL") result.hiddenLocal += 1;
      if (repair.reason === "NEEDS_PLAYER_REPAIR") result.playerRepair += 1;
      if (repair.reason === "NEEDS_TYPE_REPAIR") result.typeRepair += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.vibixCatalogIndex.update({
        where: { id: row.id },
        data: { importStatus: "FAILED", lastImportError: message.slice(0, 2_000) },
      });
      result.failed += 1;
      result.errors.push(`${row.kpId}: ${message}`.slice(0, 500));
    }
  }

  return result;
}



function normalizeSourceType(value?: string | null): VibixCatalogType {
  const normalized = stringValue(value)?.toLowerCase() ?? "";
  return ["serial", "series", "tv", "show", "series"].includes(normalized) ? "serial" : "movie";
}

function parseEmbedCode(value?: string | null) {
  const embedCode = stringValue(value);
  if (!embedCode) return { embedCode: null, vibixId: null as number | null, sourceType: null as VibixCatalogType | null };
  const idMatch = embedCode.match(/data-id=["']?(\d+)["']?/i);
  const typeMatch = embedCode.match(/data-type=["']?([a-z_\-]+)["']?/i);
  return {
    embedCode,
    vibixId: idMatch ? intValue(idMatch[1]) : null,
    sourceType: typeMatch ? normalizeSourceType(typeMatch[1]) : null,
  };
}

function mergeManualVideo(base: VibixVideo | null, manual: Partial<VibixVideo>): VibixVideo | null {
  const source = base ?? {} as VibixVideo;
  const merged: VibixVideo = {
    id: source.id ?? manual.id ?? null,
    name: source.name ?? manual.name ?? null,
    name_rus: source.name_rus ?? manual.name_rus ?? null,
    name_eng: source.name_eng ?? manual.name_eng ?? null,
    name_original: source.name_original ?? manual.name_original ?? null,
    type: source.type ?? manual.type ?? null,
    year: source.year ?? manual.year ?? null,
    kp_id: source.kp_id ?? manual.kp_id ?? null,
    kinopoisk_id: source.kinopoisk_id ?? manual.kinopoisk_id ?? null,
    imdb_id: source.imdb_id ?? manual.imdb_id ?? null,
    kp_rating: source.kp_rating ?? manual.kp_rating ?? null,
    kp_votes: source.kp_votes ?? manual.kp_votes ?? null,
    imdb_rating: source.imdb_rating ?? manual.imdb_rating ?? null,
    imdb_votes: source.imdb_votes ?? manual.imdb_votes ?? null,
    iframe_url: source.iframe_url ?? manual.iframe_url ?? null,
    embed_code: source.embed_code ?? manual.embed_code ?? null,
    persons: source.persons ?? manual.persons ?? null,
    voiceovers: source.voiceovers ?? manual.voiceovers ?? null,
    tags: source.tags ?? manual.tags ?? null,
    poster_url: source.poster_url ?? manual.poster_url ?? null,
    backdrop_url: source.backdrop_url ?? manual.backdrop_url ?? null,
    quality: source.quality ?? manual.quality ?? null,
    duration: source.duration ?? manual.duration ?? null,
    genre: source.genre ?? manual.genre ?? null,
    country: source.country ?? manual.country ?? null,
    description: source.description ?? manual.description ?? null,
    description_short: source.description_short ?? manual.description_short ?? null,
    lgbt_content: source.lgbt_content ?? manual.lgbt_content ?? null,
    updated_at: source.updated_at ?? manual.updated_at ?? null,
    uploaded_at: source.uploaded_at ?? manual.uploaded_at ?? null,
  };
  return merged.id !== null || merged.name !== null || merged.name_rus !== null || merged.kp_id !== null || merged.imdb_id !== null || merged.embed_code !== null
    ? merged
    : null;
}

async function findLocalMovieByHints(input: {
  kpId?: string | null;
  imdbId?: string | null;
  vibixId?: number | null;
  title?: string | null;
  year?: number | null;
}) {
  // Важное правило: похожее название НЕ означает, что тайтл уже есть.
  // “Игра престолов” и “Игра престолов. Последний дозор” — разные записи,
  // если KP/IMDb/Vibix ID не совпали. Поэтому сначала только строгие ID.
  const exactOr: Prisma.MovieWhereInput[] = [];
  if (input.kpId) exactOr.push({ kinopoiskId: input.kpId });
  if (input.imdbId) exactOr.push({ imdbId: input.imdbId });
  if (input.vibixId !== null && input.vibixId !== undefined) exactOr.push({ vibixId: input.vibixId });

  if (exactOr.length) {
    return prisma.movie.findFirst({
      where: { OR: exactOr },
      include: { genres: { include: { genre: true } } },
      orderBy: [{ vibixAvailable: "desc" }, { isPublicVisible: "desc" }, { updatedAt: "desc" }],
    });
  }

  const title = stringValue(input.title);
  const year = input.year ?? null;
  if (!title || !year) return null;

  return prisma.movie.findFirst({
    where: { titleRu: { equals: title, mode: "insensitive" }, year },
    include: { genres: { include: { genre: true } } },
    orderBy: [{ vibixAvailable: "desc" }, { isPublicVisible: "desc" }, { updatedAt: "desc" }],
  });
}

function visibilityDiagnosis(movie: Awaited<ReturnType<typeof findLocalMovieByHints>>) {
  if (!movie) return { exists: false, reasons: ["not_in_redfilm"] };
  const reasons: string[] = [];
  const hasPlayer = Boolean(stringValue(movie.vibixIframeUrl) || stringValue(movie.vibixEmbedCode));
  if (!movie.isPublished) reasons.push("isPublished=false");
  if (!movie.vibixAvailable) reasons.push("vibixAvailable=false");
  if (!movie.isCatalogAllowed) reasons.push(`isCatalogAllowed=false${movie.catalogBlockReason ? `:${movie.catalogBlockReason}` : ""}`);
  if (!movie.isPublicVisible) reasons.push("isPublicVisible=false");
  if (!hasPlayer) reasons.push("missing_player");
  if (!stringValue(movie.posterUrl)) reasons.push("missing_poster");
  if (!/[а-яё]/iu.test(movie.titleRu)) reasons.push("titleRu_not_russian");
  return {
    exists: true,
    id: movie.id,
    titleRu: movie.titleRu,
    slug: movie.slug,
    url: `/watch/${movie.slug}`,
    type: movie.type,
    year: movie.year,
    kinopoiskId: movie.kinopoiskId,
    imdbId: movie.imdbId,
    vibixId: movie.vibixId,
    vibixType: movie.vibixType,
    vibixAvailable: movie.vibixAvailable,
    isPublished: movie.isPublished,
    isCatalogAllowed: movie.isCatalogAllowed,
    catalogBlockReason: movie.catalogBlockReason,
    isPublicVisible: movie.isPublicVisible,
    isHomeEligible: movie.isHomeEligible,
    isPopularEligible: movie.isPopularEligible,
    isTopEligible: movie.isTopEligible,
    hasPlayer,
    hasPoster: Boolean(stringValue(movie.posterUrl)),
    hasBackdrop: Boolean(stringValue(movie.backdropUrl)),
    genres: movie.genres.map((item) => item.genre.name),
    reasons,
  };
}

export async function diagnoseVibixManualImport(input: {
  kpId?: string | null;
  imdbId?: string | null;
  vibixId?: number | null;
  embedCode?: string | null;
  title?: string | null;
  type?: string | null;
}) {
  const embed = parseEmbedCode(input.embedCode);
  const kpId = stringValue(input.kpId);
  const imdbId = stringValue(input.imdbId);
  const vibixId = input.vibixId ?? embed.vibixId;
  const sourceType = normalizeSourceType(input.type ?? embed.sourceType);
  const local = await findLocalMovieByHints({ kpId, imdbId, vibixId, title: input.title });
  const sources: Record<string, unknown> = {};

  if (kpId) {
    const lookup = await getVibixVideoByKpIdResult(kpId);
    sources.kp = { found: Boolean(lookup.video), rateLimited: lookup.rateLimited, requestFailed: lookup.requestFailed, error: lookup.error };
  }
  if (imdbId) {
    const lookup = await getVibixVideoByImdbIdResult(imdbId);
    sources.imdb = { found: Boolean(lookup.video), rateLimited: lookup.rateLimited, requestFailed: lookup.requestFailed, error: lookup.error };
  }
  if (vibixId !== null && vibixId !== undefined) {
    const lookup = await getVibixVideoByVibixIdResult(vibixId, { type: sourceType });
    sources.vibixId = { found: Boolean(lookup.video), rateLimited: lookup.rateLimited, requestFailed: lookup.requestFailed, error: lookup.error, attempts: lookup.attempts, sample: lookup.video };
  }
  if (kpId) {
    const links = await getVibixVideoLinks({ type: sourceType, page: 1, limit: 20, kpIds: [kpId] });
    sources.linksByKp = { found: links.data.length, rateLimited: links.rateLimited, requestFailed: links.requestFailed, error: links.error, sample: links.data.slice(0, 3) };
  }

  return {
    ok: true,
    input: { kpId, imdbId, vibixId, sourceType, title: stringValue(input.title), hasEmbedCode: Boolean(embed.embedCode) },
    local: visibilityDiagnosis(local),
    sources,
  };
}

export async function importVibixTitleManually(input: {
  kpId?: string | null;
  imdbId?: string | null;
  vibixId?: number | null;
  embedCode?: string | null;
  title?: string | null;
  year?: number | null;
  type?: string | null;
}) {
  const embed = parseEmbedCode(input.embedCode);
  const kpId = stringValue(input.kpId);
  const imdbId = stringValue(input.imdbId);
  const manualVibixId = input.vibixId ?? embed.vibixId;
  const sourceType = normalizeSourceType(input.type ?? embed.sourceType);
  const manual: Partial<VibixVideo> = {
    id: manualVibixId,
    name: stringValue(input.title),
    name_rus: stringValue(input.title),
    type: sourceType === "serial" ? "series" : "movie",
    year: input.year ?? null,
    kp_id: kpId,
    kinopoisk_id: kpId,
    imdb_id: imdbId,
    embed_code: embed.embedCode,
    iframe_url: null,
  };

  const before = await findLocalMovieByHints({ kpId, imdbId, vibixId: manualVibixId, title: input.title });
  const attempts: string[] = [];
  let video: VibixVideo | null = null;

  if (kpId) {
    const lookup = await getVibixVideoByKpIdResult(kpId);
    attempts.push(`kp:${kpId}:${lookup.video ? "found" : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found"}`);
    if (lookup.rateLimited) return { ok: false, message: "Vibix rate limit on KP lookup", details: { lookup, attempts } };
    if (lookup.video) video = lookup.video;
  }

  if (!video && imdbId) {
    const lookup = await getVibixVideoByImdbIdResult(imdbId);
    attempts.push(`imdb:${imdbId}:${lookup.video ? "found" : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found"}`);
    if (lookup.rateLimited) return { ok: false, message: "Vibix rate limit on IMDb lookup", details: { lookup, attempts } };
    if (lookup.video) video = lookup.video;
  }

  if (!video && manualVibixId !== null && manualVibixId !== undefined) {
    const lookup = await getVibixVideoByVibixIdResult(manualVibixId, { type: sourceType });
    attempts.push(...lookup.attempts.map((attempt) => `vibixId:${manualVibixId}:${attempt}`));
    if (lookup.rateLimited) return { ok: false, message: "Vibix rate limit on Vibix ID lookup", details: { lookup, attempts } };
    if (lookup.video) video = lookup.video;
  }

  if (!video && !kpId && manualVibixId !== null && manualVibixId !== undefined) {
    const lookup = await getVibixVideoByKpIdResult(manualVibixId);
    attempts.push(`kp_from_embed_id:${manualVibixId}:${lookup.video ? "found" : lookup.rateLimited ? "rate_limited" : lookup.requestFailed ? "request_failed" : "not_found"}`);
    if (lookup.rateLimited) return { ok: false, message: "Vibix rate limit on KP fallback lookup", details: { lookup, attempts } };
    if (lookup.video) video = lookup.video;
  }

  if (!video && (kpId || manualVibixId !== null && manualVibixId !== undefined)) {
    const lookupKpId = kpId ?? String(manualVibixId);
    const links = await getVibixVideoLinks({ type: sourceType, page: 1, limit: 20, kpIds: [lookupKpId] });
    attempts.push(`links:kp:${lookupKpId}:${links.data.length}`);
    if (links.rateLimited) return { ok: false, message: "Vibix rate limit on /links lookup", details: { links, attempts } };
    if (links.data[0]) video = links.data[0];
  }

  video = mergeManualVideo(video, manual);
  if (!video) return { ok: false, message: "Не удалось получить данные Vibix и не хватает ручных данных.", details: { attempts } };

  const hasTitle = stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_eng) || stringValue(video.name_original);
  const hasYear = intValue(video.year);
  if (!hasTitle || !hasYear) {
    return {
      ok: false,
      message: "Не хватает title/year. Укажи название и год вручную или проверь Vibix detail.",
      details: { attempts, video },
    };
  }

  const saved = await saveVibixVideo(video);
  const movieId = "movieId" in saved ? saved.movieId : null;
  const after = movieId ? await findLocalMovieByHints({ kpId, imdbId, vibixId: manualVibixId, title: input.title }) : null;
  const watchUrl = after?.slug ? `/watch/${after.slug}` : null;

  const indexWhereOr: Prisma.VibixCatalogIndexWhereInput[] = [];
  if (kpId) indexWhereOr.push({ kpId });
  if (imdbId) indexWhereOr.push({ imdbId });
  if (manualVibixId !== null && manualVibixId !== undefined) indexWhereOr.push({ vibixId: manualVibixId });

  if (movieId && indexWhereOr.length) {
    await prisma.vibixCatalogIndex.updateMany({
      where: { OR: indexWhereOr },
      data: { importStatus: saved.status === "skipped" ? "SKIPPED" : "IMPORTED", importedMovieId: movieId, importedAt: new Date(), lastImportError: saved.status === "skipped" ? saved.reason : null },
    });
  }

  return {
    ok: saved.status !== "skipped",
    message: saved.status === "skipped" ? `Vibix import skipped: ${saved.reason}` : `Импорт/обновление выполнены: ${saved.status}.`,
    details: { attempts, before: visibilityDiagnosis(before), saved, after: visibilityDiagnosis(after), watchUrl },
  };
}

export async function getVibixCatalogDashboardData() {
  const [my, snapshots, refs, indexRows, missingPreview] = await Promise.all([
    getMyCatalogStats(),
    prisma.vibixCatalogSnapshot.findMany({ orderBy: [{ sourceType: "asc" }, { key: "asc" }] }),
    prisma.vibixReferenceItem.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.vibixCatalogIndex.findMany({ select: { kpId: true, imdbId: true, vibixId: true, sourceType: true, hasPlayableLink: true, importStatus: true, indexSource: true, importedMovieId: true } }),
    prisma.vibixCatalogIndex.findMany({
      where: { importStatus: { in: ["MISSING", "MISSING_IMPORTABLE", "WRONG_LOCAL_MATCH", "HIDDEN_LOCAL", "NEEDS_PLAYER_REPAIR", "NEEDS_TYPE_REPAIR", "DETAIL_MISSING", "FAILED"] } },
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    }),
  ]);

  const localMovies = await prisma.movie.findMany({
    select: { kinopoiskId: true, imdbId: true, vibixId: true },
  });
  const localKpIds = new Set(localMovies.map((movie) => movie.kinopoiskId).filter((value): value is string => Boolean(value)));
  const localImdbIds = new Set(localMovies.map((movie) => movie.imdbId).filter((value): value is string => Boolean(value)));
  const localVibixIds = new Set(localMovies.map((movie) => movie.vibixId).filter((value): value is number => value !== null));

  let present = 0;
  let imported = 0;
  let missing = 0;
  let failed = 0;
  let rawOnly = 0;
  let detailMissing = 0;
  let playableIndex = 0;
  let playableMovie = 0;
  let playableSerial = 0;
  let playableWithPlayer = 0;
  let autoRepaired = 0;
  let verifiedOk = 0;
  let lowValueSkipped = 0;

  const presentStatuses = new Set(["PRESENT", "IMPORTED", "VERIFIED_OK", "AUTO_REPAIRED"]);
  const missingStatuses = new Set(["MISSING", "MISSING_IMPORTABLE", "WRONG_LOCAL_MATCH", "HIDDEN_LOCAL", "NEEDS_PLAYER_REPAIR", "NEEDS_TYPE_REPAIR"]);

  for (const row of indexRows) {
    const existsNow = (isRealKpId(row.kpId) && localKpIds.has(row.kpId))
      || (row.imdbId ? localImdbIds.has(row.imdbId) : false)
      || (row.vibixId !== null ? localVibixIds.has(row.vibixId) : false)
      || Boolean(row.importedMovieId)
      || presentStatuses.has(row.importStatus);
    if (existsNow) present += 1;
    if (row.importStatus === "IMPORTED") imported += 1;
    if (row.importStatus === "AUTO_REPAIRED") autoRepaired += 1;
    if (row.importStatus === "VERIFIED_OK") verifiedOk += 1;
    if (row.importStatus === "SKIP_LOW_VALUE") lowValueSkipped += 1;
    if (row.indexSource === "links") {
      playableIndex += 1;
      if (row.sourceType === "serial") playableSerial += 1;
      else playableMovie += 1;
      if (row.hasPlayableLink) playableWithPlayer += 1;
    }
    if (!existsNow && missingStatuses.has(row.importStatus) && row.indexSource === "links") missing += 1;
    if (row.importStatus === "FAILED") failed += 1;
    if (row.importStatus === "DETAIL_MISSING") detailMissing += 1;
    if (!existsNow && row.indexSource !== "links" && ["RAW_KPID", "UNKNOWN", "MISSING"].includes(row.importStatus)) rawOnly += 1;
  }

  const referenceCounts = Object.fromEntries(refs.map((item) => [item.kind, item._count._all]));
  const snapshotsByKey = new Map(snapshots.map((item) => [item.key, item]));
  const apiMovieTotal = snapshotsByKey.get("movie_all")?.total ?? null;
  const apiSerialTotal = snapshotsByKey.get("serial_all")?.total ?? null;
  const apiMovieLastPage = snapshotsByKey.get("movie_all")?.lastPage ?? null;
  const apiSerialLastPage = snapshotsByKey.get("serial_all")?.lastPage ?? null;
  const suspiciousApiTotals = isSuspiciousFullCatalogSnapshot(apiMovieTotal, apiMovieLastPage) || isSuspiciousFullCatalogSnapshot(apiSerialTotal, apiSerialLastPage);

  return {
    my,
    snapshots,
    referenceCounts,
    index: { total: indexRows.length, playable: playableIndex, playableMovie, playableSerial, playableWithPlayer, rawOnly, missing, present, imported, autoRepaired, verifiedOk, lowValueSkipped, failed, detailMissing, missingPreview },
    safeVibix: {
      apiMovieTotal,
      apiSerialTotal,
      apiKnownTotal: (apiMovieTotal ?? 0) + (apiSerialTotal ?? 0),
      suspiciousApiTotals,
      availableMovie: playableMovie,
      availableSerial: playableSerial,
      availableTotal: playableIndex,
      availableWithPlayer: playableWithPlayer,
      remainingToImport: missing,
    },
    suggestedCategoryIds: VIBIX_CATEGORY_IDS,
    suggestedFilters: VIBIX_AUDIT_FILTERS.map((item) => ({
      ...item,
      filterKind: getAuditFilterKind(item),
      filterId: getAuditFilterId(item),
      filterLabel: vibixFilterLabel(getAuditFilterKind(item), getAuditFilterId(item)),
    })),
  };
}
