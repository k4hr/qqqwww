import Link from "next/link";
import { ContentType, type Movie, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getContentTypeLabel } from "@/lib/content";
import {
  getHomeSelectionItems,
  getHomeSelectionMovieIds,
  getHomeSelectionSettings,
  getPopularMoviesFromAnalytics,
} from "@/lib/home-selection";
import {
  addHomeSelectionItem,
  moveHomeSelectionItem,
  removeHomeSelectionItem,
  saveHomeSelectionSettings,
  toggleHomeSelectionItem,
} from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    type?: string;
    added?: string;
    saved?: string;
    removed?: string;
    updated?: string;
    moved?: string;
    error?: string;
  }>;
};

type MovieCard = Pick<Movie, "id" | "slug" | "titleRu" | "year" | "type" | "posterUrl" | "kpRating" | "imdbRating" | "views" | "vibixAvailable">;

type RankedMovie = { movie: Movie; score: number };

function normalizeType(value?: string) {
  return value && Object.values(ContentType).includes(value as ContentType) ? value as ContentType : undefined;
}

function movieSearchWhere(query: string, type?: ContentType): Prisma.MovieWhereInput {
  const trimmed = query.trim();
  const where: Prisma.MovieWhereInput = {
    isPublished: true,
    isCatalogAllowed: true,
    ...(type ? { type } : {}),
  };
  if (!trimmed) return where;
  const asNumber = Number(trimmed);
  const or: Prisma.MovieWhereInput[] = [
    { titleRu: { contains: trimmed, mode: "insensitive" } },
    { titleOriginal: { contains: trimmed, mode: "insensitive" } },
    { kinopoiskId: { contains: trimmed, mode: "insensitive" } },
    { imdbId: { contains: trimmed, mode: "insensitive" } },
  ];
  if (Number.isFinite(asNumber) && asNumber > 1800) or.push({ year: asNumber });
  where.OR = or;
  return where;
}

async function searchMovies(query: string, type?: ContentType) {
  if (!query.trim()) return [] as MovieCard[];
  return prisma.movie.findMany({
    where: movieSearchWhere(query, type),
    orderBy: [
      { isHeroEligible: "desc" },
      { homeScore: "desc" },
      { views: "desc" },
      { kpVotes: "desc" },
      { imdbVotes: "desc" },
      { year: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      titleRu: true,
      year: true,
      type: true,
      posterUrl: true,
      kpRating: true,
      imdbRating: true,
      views: true,
      vibixAvailable: true,
    },
    take: 40,
  });
}

function message(params: Awaited<Props["searchParams"]>) {
  if (params.saved) return "Настройки подборки сохранены.";
  if (params.added) return "Фильм добавлен в подборку.";
  if (params.removed) return "Фильм удалён из подборки.";
  if (params.updated) return "Статус обновлён.";
  if (params.moved) return "Порядок обновлён.";
  if (params.error === "movie_not_found") return "Фильм не найден.";
  return null;
}

export default async function AdminHomeSelectionPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = normalizeType(params.type);
  const [settings, items, selectedIds, searchResults, popularDay, popularWeek] = await Promise.all([
    getHomeSelectionSettings(),
    getHomeSelectionItems(100),
    getHomeSelectionMovieIds(),
    searchMovies(q, type),
    getPopularMoviesFromAnalytics(1, 12).catch(() => [] as RankedMovie[]),
    getPopularMoviesFromAnalytics(7, 12).catch(() => [] as RankedMovie[]),
  ]);
  const info = message(params);
  const activeCount = items.filter((item) => item.isActive).length;

  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-black">Подборка главной REDFILM</h1>
        <p className="mt-1 text-neutral-600">Ручное управление большим верхним блоком “В подборке REDFILM” на главной странице.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/" className="rounded-lg border border-[#ddd] bg-white px-4 py-2 font-bold text-[#222]">Открыть главную</Link>
        <Link href="/admin/analytics" className="rounded-lg bg-[#333] px-4 py-2 font-bold text-white">Аналитика</Link>
        <Link href="/admin" className="rounded-lg bg-[#e50914] px-4 py-2 font-bold text-white">В админку</Link>
      </div>
    </div>

    {info ? <div className="admin-panel mb-5 border-green-300 bg-green-50 p-4 font-bold text-green-800">{info}</div> : null}

    <section className="admin-panel mb-6 p-5">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-xl font-black">Настройки блока</h2>
        <p className="text-sm text-neutral-600">MANUAL показывает только выбранные фильмы. MIXED сначала показывает выбранные, а пустые места добирает автоматикой. AUTO полностью отдаёт блок автоматике.</p>
      </div>
      <form action={saveHomeSelectionSettings} className="grid gap-4 lg:grid-cols-6">
        <label className="lg:col-span-2">
          <span className="mb-1 block text-sm font-bold text-neutral-600">Заголовок в админке</span>
          <input name="title" defaultValue={settings.title} className="w-full rounded-lg border border-[#ddd] px-3 py-2" />
        </label>
        <label className="lg:col-span-2">
          <span className="mb-1 block text-sm font-bold text-neutral-600">Описание</span>
          <input name="subtitle" defaultValue={settings.subtitle ?? ""} className="w-full rounded-lg border border-[#ddd] px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-neutral-600">Сколько показывать</span>
          <input name="limit" type="number" min="1" max="24" defaultValue={settings.limit} className="w-full rounded-lg border border-[#ddd] px-3 py-2" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-neutral-600">Режим</span>
          <select name="mode" defaultValue={settings.mode} className="w-full rounded-lg border border-[#ddd] px-3 py-2">
            <option value="MANUAL">MANUAL</option>
            <option value="MIXED">MIXED</option>
            <option value="AUTO">AUTO</option>
          </select>
        </label>
        <label className="flex items-center gap-2 font-bold lg:col-span-2">
          <input name="isEnabled" type="checkbox" defaultChecked={settings.isEnabled} />
          Блок ручной подборки включён
        </label>
        <div className="lg:col-span-4 flex items-end">
          <button className="rounded-lg bg-[#e50914] px-5 py-3 font-black text-white" type="submit">Сохранить настройки</button>
        </div>
      </form>
    </section>

    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <Stat title="Выбрано всего" value={items.length} />
      <Stat title="Активно" value={activeCount} />
      <Stat title="Лимит показа" value={settings.limit} />
    </div>

    <section className="admin-panel mb-6 p-5">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-black">Поиск фильмов</h2>
          <p className="text-sm text-neutral-600">Найди фильм или сериал, нажми “Добавить” — он попадёт в подборку главной.</p>
        </div>
      </div>
      <form action="/admin/home-selection" className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input name="q" defaultValue={q} placeholder="Название, год, KP ID или IMDb ID" className="rounded-lg border border-[#ddd] px-4 py-3" />
        <select name="type" defaultValue={type ?? ""} className="rounded-lg border border-[#ddd] px-4 py-3">
          <option value="">Все типы</option>
          {Object.values(ContentType).map((value) => <option key={value} value={value}>{getContentTypeLabel(value)}</option>)}
        </select>
        <button className="rounded-lg bg-[#333] px-5 py-3 font-black text-white" type="submit">Искать</button>
      </form>
      {q ? <div className="overflow-x-auto"><MovieTable movies={searchResults} selectedIds={selectedIds} source="search" returnTo={`/admin/home-selection?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`} /></div> : <p className="rounded-lg bg-[#f7f7f7] p-4 text-neutral-600">Введи название, год или ID, чтобы найти карточки в базе.</p>}
    </section>

    <section className="admin-panel mb-6 overflow-x-auto p-5">
      <h2 className="mb-4 text-xl font-black">Сейчас в подборке</h2>
      {items.length ? <table className="w-full min-w-[980px] text-sm">
        <thead className="border-b text-left text-neutral-500"><tr><th className="py-2">#</th><th>Фильм</th><th>Тип</th><th>Рейтинг</th><th>Статус</th><th>Источник</th><th className="text-right">Действия</th></tr></thead>
        <tbody className="divide-y divide-[#eee]">{items.map((item, index) => <tr key={item.id}>
          <td className="py-3 pr-3 font-bold">{index + 1}</td>
          <td className="py-3 pr-3"><div className="font-bold">{item.movie.titleRu}</div><div className="text-xs text-neutral-500">{item.movie.year} · /watch/{item.movie.slug}</div></td>
          <td className="py-3 pr-3">{getContentTypeLabel(item.movie.type)}</td>
          <td className="py-3 pr-3">КП {item.movie.kpRating?.toFixed(1) ?? "—"} · IMDb {item.movie.imdbRating?.toFixed(1) ?? "—"}</td>
          <td className="py-3 pr-3"><span className={item.isActive ? "font-bold text-green-700" : "font-bold text-neutral-500"}>{item.isActive ? "Активен" : "Скрыт"}</span>{item.isPinned ? <span className="ml-2 rounded-full bg-[#e50914]/10 px-2 py-1 text-xs font-bold text-[#e50914]">закреплён</span> : null}</td>
          <td className="py-3 pr-3 text-neutral-500">{item.addedFrom ?? "manual"}</td>
          <td className="py-3 pl-3"><div className="flex flex-wrap justify-end gap-2">
            <form action={moveHomeSelectionItem}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="direction" value="up" /><button className="rounded border border-[#ddd] px-3 py-1 font-bold" type="submit">↑</button></form>
            <form action={moveHomeSelectionItem}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="direction" value="down" /><button className="rounded border border-[#ddd] px-3 py-1 font-bold" type="submit">↓</button></form>
            <ToggleButton itemId={item.id} field="is_active" current={item.isActive} label={item.isActive ? "Скрыть" : "Включить"} />
            <ToggleButton itemId={item.id} field="is_pinned" current={item.isPinned} label={item.isPinned ? "Открепить" : "Закрепить"} />
            <form action={removeHomeSelectionItem}><input type="hidden" name="itemId" value={item.id} /><button className="rounded bg-red-50 px-3 py-1 font-bold text-red-700" type="submit">Удалить</button></form>
          </div></td>
        </tr>)}</tbody>
      </table> : <p className="text-neutral-500">Подборка пока пустая. Добавь фильмы через поиск или из аналитики ниже.</p>}
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <AnalyticsBlock title="Популярное за 24 часа" rows={popularDay} selectedIds={selectedIds} source="analytics_day" />
      <AnalyticsBlock title="Популярное за 7 дней" rows={popularWeek} selectedIds={selectedIds} source="analytics_week" />
    </section>
  </div>;
}

function ToggleButton({ itemId, field, current, label }: { itemId: string; field: "is_active" | "is_pinned"; current: boolean; label: string }) {
  return <form action={toggleHomeSelectionItem}><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="field" value={field} /><input type="hidden" name="current" value={String(current)} /><button className="rounded border border-[#ddd] px-3 py-1 font-bold" type="submit">{label}</button></form>;
}

function MovieTable({ movies, selectedIds, source, returnTo }: { movies: MovieCard[]; selectedIds: Set<string>; source: string; returnTo: string }) {
  if (!movies.length) return <p className="rounded-lg bg-[#f7f7f7] p-4 text-neutral-600">Ничего не найдено.</p>;
  return <table className="w-full min-w-[860px] text-sm"><thead className="border-b text-left text-neutral-500"><tr><th className="py-2">Название</th><th>Тип</th><th>Год</th><th>Рейтинг</th><th>Просмотры</th><th className="text-right">Действие</th></tr></thead><tbody className="divide-y divide-[#eee]">{movies.map((movie) => <tr key={movie.id}><td className="py-3 pr-3"><div className="font-bold">{movie.titleRu}</div><div className="text-xs text-neutral-500">/watch/{movie.slug}</div></td><td className="py-3 pr-3">{getContentTypeLabel(movie.type)}</td><td className="py-3 pr-3">{movie.year}</td><td className="py-3 pr-3">КП {movie.kpRating?.toFixed(1) ?? "—"} · IMDb {movie.imdbRating?.toFixed(1) ?? "—"}</td><td className="py-3 pr-3">{movie.views}</td><td className="py-3 pl-3 text-right">{selectedIds.has(movie.id) ? <span className="font-bold text-green-700">Уже в подборке</span> : <form action={addHomeSelectionItem}><input type="hidden" name="movieId" value={movie.id} /><input type="hidden" name="addedFrom" value={source} /><input type="hidden" name="returnTo" value={returnTo} /><button className="rounded-lg bg-[#e50914] px-4 py-2 font-black text-white" type="submit">Добавить</button></form>}</td></tr>)}</tbody></table>;
}

function AnalyticsBlock({ title, rows, selectedIds, source }: { title: string; rows: RankedMovie[]; selectedIds: Set<string>; source: string }) {
  return <section className="admin-panel p-5"><h2 className="mb-4 text-xl font-black">{title}</h2>{rows.length ? <ol className="space-y-3">{rows.map(({ movie, score }, index) => <li key={movie.id} className="flex flex-col gap-2 rounded-lg border border-[#eee] p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold">{index + 1}. {movie.titleRu}</div><div className="text-xs text-neutral-500">{movie.year} · {getContentTypeLabel(movie.type)} · score {score}</div></div>{selectedIds.has(movie.id) ? <span className="font-bold text-green-700">Уже добавлен</span> : <form action={addHomeSelectionItem}><input type="hidden" name="movieId" value={movie.id} /><input type="hidden" name="addedFrom" value={source} /><input type="hidden" name="returnTo" value="/admin/home-selection" /><button className="rounded-lg bg-[#e50914] px-4 py-2 font-black text-white" type="submit">В подборку</button></form>}</li>)}</ol> : <p className="text-neutral-500">Данных пока нет.</p>}</section>;
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="admin-panel p-5"><div className="text-sm text-neutral-500">{title}</div><div className="mt-2 text-4xl font-black text-[#e50914]">{value}</div></div>;
}
