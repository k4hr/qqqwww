import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditorialImageField } from "@/components/editorial-image-field";
import { resetMovieEditorial, saveMovieEditorial } from "../actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; reset?: string; error?: string; slug?: string }> };

export default async function EditorialEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const status = await searchParams;
  const movie = await prisma.movie.findUnique({ where: { id } });
  if (!movie) notFound();
  const displayTitle = movie.titleRu;
  return <div className="container admin-shell py-6 text-[#222]">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-bold text-[#e50914]">РЕДАКЦИЯ</div><h1 className="text-3xl font-black">{displayTitle}</h1><p className="mt-1 text-neutral-500">{movie.year} · /watch/{movie.slug}</p></div><div className="flex gap-2"><Link href={`/watch/${movie.slug}`} target="_blank" className="rounded-xl border border-[#ddd] px-4 py-3 font-bold">Открыть watch</Link><Link href="/admin/editorial" className="rounded-xl bg-[#333] px-4 py-3 font-bold text-white">← К списку</Link></div></div>
    {status.saved ? <div className="mb-4 rounded-xl bg-emerald-50 p-4 font-bold text-emerald-800">Изменения сохранены во всём каталоге. Новый адрес: /watch/{status.slug || movie.slug}</div> : null}
    {status.error === "empty_title" ? <div className="mb-4 rounded-xl bg-red-50 p-4 font-bold text-red-800">Название не может быть пустым.</div> : null}
    {status.reset ? <div className="mb-4 rounded-xl bg-neutral-100 p-4 font-bold">Ручная редакция сброшена.</div> : null}
    <form action={saveMovieEditorial} className="admin-panel grid gap-6 p-5" encType="multipart/form-data">
      <input type="hidden" name="id" value={movie.id} />
      <section className="grid gap-3"><label className="grid gap-2"><span className="text-sm font-bold">Название во всём каталоге</span><input name="titleRu" defaultValue={movie.titleRu} className="rounded-xl border border-[#ddd] px-4 py-3 text-lg font-bold" required /></label><div className="rounded-xl bg-[#f7f7f7] p-4 text-sm text-neutral-600">После сохранения название изменится на главной, в каталоге, поиске, SEO, sitemap и на странице watch. Slug сформируется автоматически: <b>/watch/{movie.slug}</b> → <b>/watch/novoe-nazvanie-{movie.year}</b>. Старый адрес останется рабочим и будет перенаправлять на новый.</div>{movie.editorialTitleLocked && movie.editorialSourceTitleRu ? <div className="text-xs text-neutral-500">Исходное автоматическое название: «{movie.editorialSourceTitleRu}»</div> : null}</section>
      <div className="grid gap-6 lg:grid-cols-[minmax(220px,320px)_1fr]"><EditorialImageField name="editorialPosterUrl" label="Постер" currentUrl={movie.editorialPosterUrl} aspect="poster" /><EditorialImageField name="editorialBackdropUrl" label="Задник страницы watch" currentUrl={movie.editorialBackdropUrl} aspect="backdrop" /></div>
      <div className="rounded-xl bg-[#f7f7f7] p-4 text-sm text-neutral-600"><b>Автоматические изображения сейчас:</b><div className="mt-3 grid gap-4 sm:grid-cols-2">{movie.posterUrl ? <div><div className="mb-2 font-bold">Постер источника</div><div className="relative aspect-[2/3] max-w-[150px] overflow-hidden rounded-lg"><Image src={movie.posterUrl} alt="" fill unoptimized className="object-cover" /></div></div> : null}{movie.backdropUrl ? <div><div className="mb-2 font-bold">Задник источника</div><div className="relative aspect-video overflow-hidden rounded-lg"><Image src={movie.backdropUrl} alt="" fill unoptimized className="object-cover" /></div></div> : null}</div></div>
      <button className="rounded-xl bg-[#e50914] px-6 py-4 text-lg font-black text-white">Сохранить редакцию</button>
    </form>
    <form action={resetMovieEditorial} className="mt-4"><input type="hidden" name="id" value={movie.id} /><button className="rounded-xl border border-red-300 px-5 py-3 font-bold text-red-700">Сбросить всю ручную редакцию</button></form>
  </div>;
}
