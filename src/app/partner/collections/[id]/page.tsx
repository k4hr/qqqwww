import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { partnerRemoveMovie, partnerReorderMovies, partnerSubmitCollection, partnerUpdateCollection } from "@/app/partner/actions";
import { PartnerCatalogSearch } from "@/app/partner/collections/[id]/catalog-search";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PartnerCollectionEditorPage({ params }: Props) {
  const { partner } = await requirePartnerSession();
  const { id } = await params;
  const collection = await prisma.creatorCollection.findUnique({ where: { id } });
  if (!collection || collection.partnerId !== partner.id) notFound();
  const items = await prisma.creatorCollectionMovie.findMany({ where: { collectionId: collection.id }, orderBy: { position: "asc" } });
  const movies = await prisma.movie.findMany({ where: { id: { in: items.map((item) => item.movieId) } }, select: { id: true, slug: true, titleRu: true, year: true, posterUrl: true, kpRating: true, imdbRating: true, type: true, quality: true } });
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  return (
    <PartnerShell title={collection.title} description={`Статус: ${collection.status}. Добавляйте фильмы, комментарии и порядок.`}>
      <section className="mf-panel p-5">
        <form action={partnerUpdateCollection} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={collection.id} />
          <PartnerField label="Название"><input name="title" defaultValue={collection.title} required className={partnerInput} /></PartnerField>
          <PartnerField label="Slug"><input name="slug" defaultValue={collection.slug} required className={partnerInput} /></PartnerField>
          <PartnerField label="Обложка"><input name="coverUrl" defaultValue={collection.coverUrl || ""} className={partnerInput} /></PartnerField>
          <PartnerField label="Позиция"><input name="position" defaultValue={collection.position} className={partnerInput} /></PartnerField>
          <PartnerField label="Описание"><textarea name="description" defaultValue={collection.description || ""} className={`${partnerInput} min-h-28`} /></PartnerField>
          {collection.moderationComment ? <div className="rounded-2xl border border-[#e50914]/40 bg-[#e50914]/10 p-4 text-sm text-white"><b>Комментарий модератора:</b> {collection.moderationComment}</div> : null}
          <div className="md:col-span-2 flex flex-wrap gap-2"><button className={partnerButton}>Сохранить</button><Link className="mf-btn" href="/partner/collections">Назад</Link></div>
        </form>
      </section>

      <section className="mf-panel mt-6 p-5">
        <h2 className="text-xl font-black text-white">Фильмы в подборке</h2>
        <form action={partnerReorderMovies} className="mt-4 grid gap-3">
          <input type="hidden" name="collectionId" value={collection.id} />
          {items.map((item) => {
            const movie = movieById.get(item.movieId);
            if (!movie) return null;
            return (
              <div key={item.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[80px_minmax(0,1fr)_120px] md:items-center">
                <input name={`position:${item.id}`} defaultValue={item.position} className={partnerInput} />
                <div>
                  <Link href={watchPath(movie)} className="font-black text-white hover:text-[#ff4d55]">{movie.titleRu}</Link>
                  <div className="text-sm text-[#a1a1aa]">{movie.year} · {movie.type}</div>
                  <input name={`comment:${item.id}`} defaultValue={item.authorComment || ""} className={`${partnerInput} mt-2 w-full`} placeholder="Почему советую..." />
                </div>
                <button formAction={partnerRemoveMovie} name="id" value={item.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white">Удалить</button>
              </div>
            );
          })}
          <button className={partnerButton}>Сохранить порядок и комментарии</button>
        </form>
      </section>

      <div className="mt-6">
        <PartnerCatalogSearch collectionId={collection.id} />
      </div>

      <section className="mf-panel mt-6 p-5">
        <form action={partnerSubmitCollection}>
          <input type="hidden" name="id" value={collection.id} />
          <button className={partnerButton}>{partner.requireCollectionModeration ? "Отправить на модерацию" : "Опубликовать"}</button>
        </form>
      </section>
    </PartnerShell>
  );
}
