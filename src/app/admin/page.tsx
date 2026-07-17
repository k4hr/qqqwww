import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toggleMoviePublished } from "./actions";
import { getContentTypeLabel } from "@/lib/content";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Props = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

function makeAdminUrl(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 200);
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  const catalogWhere: Prisma.MovieWhereInput = q
    ? {
        OR: [
          { titleRu: { contains: q, mode: "insensitive" } },
          { titleOriginal: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { kinopoiskId: { contains: q, mode: "insensitive" } },
          { imdbId: { contains: q, mode: "insensitive" } },
          { tmdbId: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, published, withVibix, matchingCount] = await Promise.all([
    prisma.movie.count(),
    prisma.movie.count({ where: { isPublished: true } }),
    prisma.movie.count({ where: vibixPublicMovieWhere }),
    prisma.movie.count({ where: catalogWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const movies = await prisma.movie.findMany({
    where: catalogWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const returnTo = makeAdminUrl(q, currentPage);

  return (
    <div className="container admin-shell py-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#222]">Админка REDFILM</h1>
          <p className="mt-1 text-neutral-600">Быстрый вход в операционный центр, SEO, Telegram, рекламу и аналитику.</p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:[&>a]:w-full max-sm:[&>a]:justify-center">
          <Link href="/admin/catalog" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">Операционный центр</Link>
          <Link href="/admin/catalog/vibix" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">Смотреть VIBIX</Link>
          <Link href="/admin/seo" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">SEO</Link>
          <Link href="/admin/telegram" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">Telegram</Link>
          <Link href="/admin/ads" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">РЕКЛАМА</Link>
          <Link href="/admin/home-selection" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">Подборка главной</Link>
          <Link href="/admin/collaboration" className="rounded-sm bg-[#e50914] px-5 py-3 font-bold text-white">Сотрудничество</Link>
          <Link href="/admin/analytics" className="rounded-sm bg-[#333] px-5 py-3 font-bold text-white">Аналитика</Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Всего карточек" value={total} />
        <Stat title="Опубликовано" value={published} />
        <Stat title="Доступно в Vibix" value={withVibix} />
        <Stat title="Без Vibix-плеера" value={total - withVibix} />
      </div>

      <div className="admin-panel p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#222]">Весь каталог</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {q ? `Найдено: ${matchingCount}` : `Всего в каталоге: ${matchingCount}`}
            </p>
          </div>

          <form action="/admin" method="get" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Название, оригинальное название, slug, ID Кинопоиска, IMDb или TMDB"
              className="min-w-0 flex-1 rounded-xl border border-[#d8d8d8] bg-white px-4 py-3 text-sm text-[#222] outline-none transition focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/15"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#e50914] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#c90812]"
            >
              Найти
            </button>
            {q ? (
              <Link
                href="/admin"
                className="rounded-xl border border-[#d8d8d8] px-5 py-3 text-center text-sm font-bold text-[#333] transition hover:bg-[#f5f5f5]"
              >
                Сбросить
              </Link>
            ) : null}
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[#222]">
            <thead className="border-b border-[#e5e5e5] text-left text-neutral-500">
              <tr>
                <th className="py-3 pr-4">Название</th>
                <th className="py-3 pr-4">Тип</th>
                <th className="py-3 pr-4">Год</th>
                <th className="py-3 pr-4">Плеер</th>
                <th className="py-3 pr-4">Статус</th>
                <th className="py-3 pr-4">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee]">
              {movies.map((movie) => (
                <tr key={movie.id}>
                  <td className="py-3 pr-4 font-medium">
                    <Link className="hover:text-[#e50914]" href={`/movie/${movie.slug}`}>
                      {movie.titleRu}
                    </Link>
                    {movie.titleOriginal ? (
                      <div className="mt-0.5 text-xs font-normal text-neutral-400">{movie.titleOriginal}</div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{getContentTypeLabel(movie.type)}</td>
                  <td className="py-3 pr-4">{movie.year}</td>
                  <td className="py-3 pr-4 text-neutral-500">{movie.vibixIframeUrl || movie.vibixEmbedCode ? "Vibix" : "нет"}</td>
                  <td className="py-3 pr-4">
                    <span className={movie.isPublished ? "font-medium text-emerald-700" : "font-medium text-[#e50914]"}>
                      {movie.isPublished ? "Опубликовано" : "Скрыто"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <form action={toggleMoviePublished}>
                      <input type="hidden" name="id" value={movie.id} />
                      <input type="hidden" name="isPublished" value={String(movie.isPublished)} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button
                        className="rounded-xl border border-[#ddd] px-3 py-1 transition hover:bg-[#f5f5f5]"
                        type="submit"
                      >
                        {movie.isPublished ? "Скрыть" : "Опубликовать"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {!movies.length ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    По запросу «{q}» ничего не найдено.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-[#eee] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-neutral-500">
              Страница {currentPage} из {totalPages}
            </div>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link
                  href={makeAdminUrl(q, currentPage - 1)}
                  className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-bold text-[#333] transition hover:bg-[#f5f5f5]"
                >
                  ← Назад
                </Link>
              ) : null}
              {currentPage < totalPages ? (
                <Link
                  href={makeAdminUrl(q, currentPage + 1)}
                  className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-bold text-[#333] transition hover:bg-[#f5f5f5]"
                >
                  Вперёд →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="admin-panel p-5">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-2 text-4xl font-bold text-[#e50914]">{value}</div>
    </div>
  );
}
