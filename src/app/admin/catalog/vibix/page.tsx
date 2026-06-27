import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVibixVideoLinks, searchVibixVideosResult, type VibixCatalogType, type VibixVideo } from "@/lib/vibix";
import { VIBIX_CATEGORY_IDS } from "@/lib/vibix-catalog/vibix-taxonomy-ids";
import { importVibixBrowserItemAction, moveVibixBrowserPageMoviesToAnimeAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    result?: string;
    type?: string;
    category?: string;
    year?: string;
    page?: string;
    q?: string;
  }>;
};

type ActionResult = { ok?: boolean; message?: string; details?: unknown } | null;

type LocalMovieMatch = {
  id: string;
  slug: string;
  titleRu: string;
  year: number;
  vibixId: number | null;
  kinopoiskId: string | null;
  imdbId: string | null;
  vibixAvailable: boolean;
  isPublished: boolean;
  isPublicVisible: boolean;
  vibixIframeUrl: string | null;
  vibixEmbedCode: string | null;
  type: string;
};

const CATEGORY_OPTIONS = [
  { value: "", label: "Все категории", categoryId: null },
  { value: "anime", label: "Аниме", categoryId: VIBIX_CATEGORY_IDS.anime },
  { value: "cartoon", label: "Мультфильмы", categoryId: VIBIX_CATEGORY_IDS.cartoon },
  { value: "adultCartoon", label: "Мультфильмы 18+", categoryId: VIBIX_CATEGORY_IDS.adultCartoon },
  { value: "dorama", label: "Дорамы", categoryId: VIBIX_CATEGORY_IDS.dorama },
  { value: "lakorn", label: "Лакорны", categoryId: VIBIX_CATEGORY_IDS.lakorn },
  { value: "mainstream", label: "Мейнстрим", categoryId: VIBIX_CATEGORY_IDS.mainstream },
] as const;

function parseResult(value?: string): ActionResult {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as ActionResult;
  } catch {
    return { ok: false, message: "Не удалось прочитать результат действия." };
  }
}

function safeInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU");
}

function titleOf(video: VibixVideo) {
  return stringValue(video.name_rus) || stringValue(video.name) || stringValue(video.name_original) || stringValue(video.name_eng) || `Vibix ${video.id ?? "—"}`;
}

function kindOf(video: VibixVideo, categoryId?: number | null) {
  if (categoryId === 18) return "Аниме";
  if (categoryId === 14 || categoryId === 21) return "Мультфильм";
  const value = stringValue(video.type)?.toLowerCase() ?? "";
  if (["series", "serial", "tv", "show"].includes(value)) return "Сериал";
  return "Фильм";
}

function compactList(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const parts = value.map(compactList).filter((item) => item !== "—");
    return parts.slice(0, 4).join(", ") || "—";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return stringValue(record.name_rus) || stringValue(record.name) || stringValue(record.title) || Object.values(record).map(compactList).filter((item) => item !== "—").slice(0, 4).join(", ") || "—";
  }
  return String(value);
}

function encodedVideo(video: VibixVideo) {
  return Buffer.from(JSON.stringify(video)).toString("base64url");
}

function buildUrl(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim()) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `/admin/catalog/vibix?${query}` : "/admin/catalog/vibix";
}

async function getLocalMatches(videos: VibixVideo[]) {
  const kpIds = Array.from(new Set(videos.map((video) => stringValue(video.kp_id) || stringValue(video.kinopoisk_id)).filter((value): value is string => Boolean(value))));
  const imdbIds = Array.from(new Set(videos.map((video) => stringValue(video.imdb_id)).filter((value): value is string => Boolean(value))));
  const vibixIds = Array.from(new Set(videos.map((video) => intValue(video.id)).filter((value): value is number => value !== null)));
  const or: Prisma.MovieWhereInput[] = [];
  if (kpIds.length) or.push({ kinopoiskId: { in: kpIds } });
  if (imdbIds.length) or.push({ imdbId: { in: imdbIds } });
  if (vibixIds.length) or.push({ vibixId: { in: vibixIds } });
  if (!or.length) return { byKp: new Map<string, LocalMovieMatch>(), byImdb: new Map<string, LocalMovieMatch>(), byVibix: new Map<number, LocalMovieMatch>() };

  const movies = await prisma.movie.findMany({
    where: { OR: or },
    select: {
      id: true,
      slug: true,
      titleRu: true,
      year: true,
      vibixId: true,
      kinopoiskId: true,
      imdbId: true,
      vibixAvailable: true,
      isPublished: true,
      isPublicVisible: true,
      vibixIframeUrl: true,
      vibixEmbedCode: true,
      type: true,
    },
  });

  const byKp = new Map<string, LocalMovieMatch>();
  const byImdb = new Map<string, LocalMovieMatch>();
  const byVibix = new Map<number, LocalMovieMatch>();
  for (const movie of movies) {
    if (movie.kinopoiskId) byKp.set(movie.kinopoiskId, movie);
    if (movie.imdbId) byImdb.set(movie.imdbId, movie);
    if (movie.vibixId !== null) byVibix.set(movie.vibixId, movie);
  }
  return { byKp, byImdb, byVibix };
}

function matchLocal(video: VibixVideo, maps: Awaited<ReturnType<typeof getLocalMatches>>) {
  const vibixId = intValue(video.id);
  const kpId = stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
  const imdbId = stringValue(video.imdb_id);
  return (vibixId !== null ? maps.byVibix.get(vibixId) : undefined) ?? (kpId ? maps.byKp.get(kpId) : undefined) ?? (imdbId ? maps.byImdb.get(imdbId) : undefined) ?? null;
}

export default async function AdminVibixBrowserPage({ searchParams }: Props) {
  const params = await searchParams;
  const actionResult = parseResult(params.result);
  const sourceType: VibixCatalogType = params.type === "serial" ? "serial" : "movie";
  const categoryOption = CATEGORY_OPTIONS.find((item) => item.value === params.category) ?? CATEGORY_OPTIONS[0];
  const page = safeInt(params.page, 1, 1, 100_000);
  const year = params.year && /^\d{4}$/.test(params.year) ? safeInt(params.year, 2026, 1880, 2200) : null;
  const query = stringValue(params.q);

  const response = query
    ? await searchVibixVideosResult(query, { type: sourceType, year: year ?? undefined, limit: 20 })
    : await getVibixVideoLinks({
        type: sourceType,
        page,
        limit: 20,
        year: year ?? undefined,
        categoryIds: categoryOption.categoryId ? [categoryOption.categoryId] : undefined,
      });
  const localMaps = await getLocalMatches(response.data);
  const pageAnimeCandidateIds = categoryOption.categoryId === VIBIX_CATEGORY_IDS.anime
    ? Array.from(new Set(response.data.map((video) => matchLocal(video, localMaps)).filter((movie): movie is LocalMovieMatch => Boolean(movie && movie.type === "MOVIE")).map((movie) => movie.id)))
    : [];
  const total = response.meta?.total ?? null;
  const lastPage = response.meta?.lastPage ?? null;

  return (
    <div className="container admin-shell py-6">
      <Link href="/admin/catalog" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в каталог</Link>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="break-words text-[clamp(1.75rem,6vw,2.5rem)] font-black text-[#222]">СМОТРЕТЬ VIBIX</h1>
          <p className="mt-2 max-w-4xl text-neutral-600">Живой список из Vibix: смотри новинки, фильтруй по типу/категории и вручную добавляй тайтлы на REDFILM одной кнопкой.</p>
        </div>
        <div className="rounded-2xl bg-[#f5f5f5] px-4 py-3 text-sm text-[#333]">
          <b>Страница:</b> {page} {lastPage ? `/ ${lastPage}` : null}<br />
          <b>Всего Vibix:</b> {total?.toLocaleString("ru-RU") ?? "—"}
        </div>
      </div>

      {actionResult ? (
        <div className={`mt-5 rounded-xl border px-4 py-3 ${actionResult.ok === false ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <div className="font-bold">{actionResult.message ?? "Готово"}</div>
          {actionResult.details ? <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-[#222]">{JSON.stringify(actionResult.details, null, 2)}</pre> : null}
        </div>
      ) : null}

      <form className="admin-panel mt-5 grid gap-3 p-5 lg:grid-cols-6" action="/admin/catalog/vibix">
        <label className="text-sm font-bold text-[#333]">
          Тип
          <select className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name="type" defaultValue={sourceType}>
            <option value="movie">Фильмы</option>
            <option value="serial">Сериалы</option>
          </select>
        </label>
        <label className="text-sm font-bold text-[#333]">
          Категория
          <select className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name="category" defaultValue={categoryOption.value}>
            {CATEGORY_OPTIONS.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#333]">
          Год
          <input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name="year" type="number" min="1880" max="2200" placeholder="Все годы" defaultValue={year ?? ""} />
        </label>
        <label className="text-sm font-bold text-[#333] lg:col-span-2">
          Поиск в Vibix
          <input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name="q" type="search" placeholder="Название фильма/сериала" defaultValue={query ?? ""} />
        </label>
        <label className="text-sm font-bold text-[#333]">
          Страница
          <input className="mt-2 h-12 w-full rounded-xl border border-[#ddd] bg-white px-4 text-[#222]" name="page" type="number" min="1" max="100000" defaultValue={query ? 1 : page} />
        </label>
        <button className="h-12 rounded-xl bg-[#e50914] px-5 font-bold text-white lg:col-span-2">Показать Vibix</button>
        <Link href="/admin/catalog/vibix" className="flex h-12 items-center justify-center rounded-xl border border-[#ddd] bg-white px-5 font-bold text-[#222] lg:col-span-2">Сбросить</Link>
        <Link href="/admin/catalog" className="flex h-12 items-center justify-center rounded-xl bg-[#333] px-5 font-bold text-white lg:col-span-2">Каталог REDFILM</Link>
      </form>

      {pageAnimeCandidateIds.length ? (
        <form action={moveVibixBrowserPageMoviesToAnimeAction} className="mt-4 rounded-2xl border border-[#e50914]/25 bg-[#fff5f5] p-4 text-sm text-[#222]">
          <input type="hidden" name="movieIds" value={JSON.stringify(pageAnimeCandidateIds)} />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-black">На этой странице есть аниме, которые лежат в разделе “Фильмы”</div>
              <div className="mt-1 text-neutral-600">Нажми кнопку — эти {pageAnimeCandidateIds.length} тайтлов будут перенесены в раздел “Аниме”.</div>
            </div>
            <button className="h-11 rounded-xl bg-[#e50914] px-5 font-black text-white">Перенести страницу в аниме</button>
          </div>
        </form>
      ) : null}

      {response.rateLimited ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Vibix вернул rate limit. Подожди немного и повтори.</div>
      ) : null}
      {response.requestFailed ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Ошибка Vibix API: {response.error ? `HTTP ${response.error.status} ${response.error.statusText}` : "request failed"}</div>
      ) : null}

      <section className="admin-panel mt-5 overflow-x-auto p-0">
        <table className="w-full min-w-[1280px] text-left text-sm text-[#222]">
          <thead className="border-b border-[#ddd] bg-[#f8f8f8] text-xs uppercase text-neutral-500">
            <tr>
              <th className="p-3">Добавить</th>
              <th className="p-3">Vibix</th>
              <th className="p-3">Название</th>
              <th className="p-3">Тип</th>
              <th className="p-3">Год</th>
              <th className="p-3">Жанры</th>
              <th className="p-3">Рейтинг</th>
              <th className="p-3">KP / IMDb</th>
              <th className="p-3">Добавлено в Vibix</th>
              <th className="p-3">Статус REDFILM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee]">
            {response.data.map((video, index) => {
              const local = matchLocal(video, localMaps);
              const title = titleOf(video);
              const kpId = stringValue(video.kp_id) || stringValue(video.kinopoisk_id);
              const imdbId = stringValue(video.imdb_id);
              const hasPlayer = Boolean(stringValue(video.iframe_url) || stringValue(video.embed_code));
              const localWatchAvailable = local ? local.isPublished && local.vibixAvailable && Boolean(stringValue(local.vibixIframeUrl) || stringValue(local.vibixEmbedCode)) : false;
              return (
                <tr key={`${video.id ?? "noid"}-${kpId ?? "nokp"}-${index}`} className="align-top hover:bg-[#fff8f8]">
                  <td className="p-3">
                    {local ? (
                      <Link href={`/watch/${local.slug}`} className="inline-flex h-10 items-center rounded-xl bg-[#333] px-4 text-xs font-black text-white">Открыть</Link>
                    ) : (
                      <form action={importVibixBrowserItemAction}>
                        <input type="hidden" name="sourceType" value={sourceType} />
                        <input type="hidden" name="sourceCategoryId" value={categoryOption.categoryId ?? ""} />
                        <input type="hidden" name="sourceCategoryLabel" value={categoryOption.label} />
                        <input type="hidden" name="videoJson" value={encodedVideo(video)} />
                        <button className="h-10 rounded-xl bg-[#e50914] px-4 text-xs font-black text-white disabled:bg-neutral-400" disabled={!hasPlayer}>Добавить</button>
                      </form>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="font-black text-[#e50914]">{video.id ?? "—"}</div>
                    <div className="mt-1 text-xs text-neutral-500">{hasPlayer ? "player ok" : "нет player"}</div>
                  </td>
                  <td className="max-w-[280px] p-3">
                    <div className="font-bold">{title}</div>
                    {stringValue(video.name_original) || stringValue(video.name_eng) ? <div className="mt-1 text-xs text-neutral-500">{stringValue(video.name_original) || stringValue(video.name_eng)}</div> : null}
                    {stringValue(video.quality) ? <span className="mt-2 inline-flex rounded-lg bg-[#e50914] px-2 py-1 text-xs font-bold text-white">{video.quality}</span> : null}
                  </td>
                  <td className="p-3">{kindOf(video, categoryOption.categoryId)}</td>
                  <td className="p-3">{video.year ?? "—"}</td>
                  <td className="max-w-[260px] p-3 text-xs">{compactList(video.genre)}</td>
                  <td className="p-3 text-xs">
                    <div>КП: <b>{video.kp_rating ?? "—"}</b></div>
                    <div>IMDb: <b>{video.imdb_rating ?? "—"}</b></div>
                  </td>
                  <td className="p-3 text-xs">
                    <div>KP: <b>{kpId ?? "—"}</b></div>
                    <div>IMDb: <b>{imdbId ?? "—"}</b></div>
                  </td>
                  <td className="p-3 text-xs">
                    <div><b>uploaded:</b> {date(video.uploaded_at)}</div>
                    <div className="mt-1 text-neutral-500"><b>updated:</b> {date(video.updated_at)}</div>
                  </td>
                  <td className="p-3 text-xs">
                    {local ? (
                      <div>
                        <div className="font-black text-green-700">Уже есть</div>
                        <Link href={`/watch/${local.slug}`} className="mt-1 block max-w-[220px] truncate text-[#e50914] hover:underline">{local.titleRu} ({local.year})</Link>
                        <div className="mt-1 text-neutral-500">watch: {localWatchAvailable ? "yes" : "no"}, public: {local.isPublicVisible ? "yes" : "no"}, vibix: {local.vibixAvailable ? "yes" : "no"}</div>
                      </div>
                    ) : (
                      <div className={hasPlayer ? "font-bold text-red-700" : "font-bold text-neutral-500"}>{hasPlayer ? "Нет на сайте" : "Нет player"}</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!response.data.length ? (
              <tr><td className="p-5 text-neutral-500" colSpan={10}>Ничего не найдено. Попробуй другой тип, категорию, год или поиск.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={buildUrl({ type: sourceType, category: categoryOption.value, year, page: Math.max(1, page - 1), q: query })} className="rounded-xl border border-[#ddd] bg-white px-5 py-3 font-bold text-[#222]">← Предыдущая</Link>
        <Link href={buildUrl({ type: sourceType, category: categoryOption.value, year, page: page + 1, q: query })} className="rounded-xl bg-[#333] px-5 py-3 font-bold text-white">Следующая →</Link>
      </div>
    </div>
  );
}
