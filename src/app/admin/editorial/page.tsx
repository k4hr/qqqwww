import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getContentTypeLabel } from "@/lib/content";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

function url(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/admin/editorial?${params}` : "/admin/editorial";
}

export default async function EditorialPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 200);
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const where: Prisma.MovieWhereInput = q ? { OR: [
    { titleRu: { contains: q, mode: "insensitive" } },
    { titleOriginal: { contains: q, mode: "insensitive" } },
    { slug: { contains: q, mode: "insensitive" } },
    { kinopoiskId: { contains: q, mode: "insensitive" } },
  ] } : {};
  const count = await prisma.movie.count({ where });
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const movies = await prisma.movie.findMany({ where, orderBy: [{ editorialUpdatedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });

  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-black">РЕДАКЦИЯ</h1><p className="mt-1 text-neutral-600">Ручное название, постер и задник для страницы просмотра. Эти поля имеют приоритет над автоматической загрузкой.</p></div>
      <Link href="/admin" className="rounded-xl bg-[#333] px-5 py-3 font-bold text-white">← В админку</Link>
    </div>
    <section className="admin-panel p-5">
      <form action="/admin/editorial" method="get" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} placeholder="Название, slug или ID Кинопоиска" className="min-w-0 flex-1 rounded-xl border border-[#ddd] px-4 py-3" />
        <button className="rounded-xl bg-[#e50914] px-6 py-3 font-bold text-white">Найти</button>
        {q ? <Link href="/admin/editorial" className="rounded-xl border border-[#ddd] px-5 py-3 text-center font-bold">Сбросить</Link> : null}
      </form>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-neutral-500"><th className="py-3">Название</th><th>Тип</th><th>Год</th><th>Ручные данные</th><th></th></tr></thead><tbody className="divide-y divide-[#eee]">
        {movies.map((movie) => <tr key={movie.id}><td className="py-3"><b>{movie.titleRu}</b>{movie.editorialTitleLocked && movie.editorialSourceTitleRu ? <div className="text-xs text-neutral-400">Источник: {movie.editorialSourceTitleRu}</div> : null}</td><td>{getContentTypeLabel(movie.type)}</td><td>{movie.year}</td><td>{[movie.editorialTitleLocked && "название+slug", movie.editorialPosterUrl && "постер", movie.editorialBackdropUrl && "задник"].filter(Boolean).join(" · ") || "нет"}</td><td className="text-right"><Link href={`/admin/editorial/${movie.id}`} className="rounded-xl bg-[#e50914] px-4 py-2 font-bold text-white">Редактировать</Link></td></tr>)}
      </tbody></table></div>
      {pages > 1 ? <div className="mt-5 flex items-center justify-between border-t pt-5"><span>Страница {page} из {pages}</span><div className="flex gap-2">{page > 1 ? <Link className="rounded-xl border px-4 py-2 font-bold" href={url(q,page-1)}>← Назад</Link> : null}{page < pages ? <Link className="rounded-xl border px-4 py-2 font-bold" href={url(q,page+1)}>Вперёд →</Link> : null}</div></div> : null}
    </section>
  </div>;
}
