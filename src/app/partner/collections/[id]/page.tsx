import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { partnerReorderMovies, partnerSubmitCollection, partnerUpdateCollection } from "@/app/partner/actions";
import { PartnerCatalogSearch } from "@/app/partner/collections/[id]/catalog-search";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { ImageUploadField } from "@/components/image-upload-field";
import { watchPath } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const statusLabel: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING_REVIEW: "На модерации",
  PUBLISHED: "Опубликована",
  REJECTED: "Нужно исправить",
  ARCHIVED: "В архиве",
};

export default async function PartnerCollectionEditorPage({ params }: Props) {
  const { partner } = await requirePartnerSession();
  const { id } = await params;
  const collection = await prisma.creatorCollection.findUnique({ where: { id } });
  if (!collection || collection.partnerId !== partner.id) notFound();
  const items = await prisma.creatorCollectionMovie.findMany({ where: { collectionId: collection.id }, orderBy: { position: "asc" } });
  const movies = await prisma.movie.findMany({ where: { id: { in: items.map((item) => item.movieId) } }, select: { id: true, slug: true, titleRu: true, year: true, posterUrl: true, kpRating: true, imdbRating: true, type: true, quality: true } });
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  return (
    <PartnerShell title={collection.title} description={`Статус подборки: ${statusLabel[collection.status] || collection.status}`}>
      <section className="mf-panel p-5">
        <form action={partnerUpdateCollection} className="grid gap-4" encType="multipart/form-data">
          <input type="hidden" name="id" value={collection.id} />
          <PartnerField label="Название подборки"><input name="title" defaultValue={collection.title} required className={partnerInput} /></PartnerField>
          <PartnerField label="Описание подборки"><textarea name="description" defaultValue={collection.description || ""} className={`${partnerInput} min-h-32`} placeholder="Расскажите, что объединяет фильмы и сериалы в этой подборке" /></PartnerField>
          <ImageUploadField name="coverImage" label="Обложка подборки" currentUrl={collection.coverUrl} dark />
          {collection.moderationComment ? <div className="rounded-2xl border border-[#e50914]/40 bg-[#e50914]/10 p-4 text-sm text-white"><b>Комментарий модератора:</b> {collection.moderationComment}</div> : null}
          <div className="flex flex-wrap gap-2"><button className={partnerButton}>Сохранить изменения</button><Link className="mf-btn" href="/partner/collections">Назад к подборкам</Link></div>
        </form>
      </section>

      <section className="mf-panel mt-6 p-5">
        <h2 className="text-xl font-black text-white">Фильмы и сериалы в подборке</h2>
        <p className="mt-1 text-sm text-[#a1a1aa]">Меняйте позицию, добавляйте личный комментарий и сохраняйте изменения одной кнопкой.</p>
        <form action={partnerReorderMovies} className="mt-4 grid gap-3">
          <input type="hidden" name="collectionId" value={collection.id} />
          {items.map((item) => {
            const movie = movieById.get(item.movieId);
            if (!movie) return null;
            return (
              <div key={item.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[72px_minmax(0,1fr)_140px] md:items-center">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                  {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" unoptimized /> : null}
                </div>
                <div>
                  <Link href={watchPath(movie)} className="font-black text-white hover:text-[#ff4d55]">{movie.titleRu}</Link>
                  <div className="text-sm text-[#a1a1aa]">{movie.year} · {movie.type}</div>
                  <label className="mt-3 grid gap-1 text-sm font-bold text-white"><span>Почему советую</span><input name={`comment:${item.id}`} defaultValue={item.authorComment || ""} className={partnerInput} placeholder="Короткий личный комментарий" /></label>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-bold text-white"><span>Позиция в подборке</span><input name={`position:${item.id}`} type="number" min="0" defaultValue={item.position} className={partnerInput} /></label>
                  <button type="submit" name="removeId" value={item.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white hover:border-[#e50914]">Удалить</button>
                </div>
              </div>
            );
          })}
          {items.length ? <button className={partnerButton}>Сохранить порядок и комментарии</button> : <div className="rounded-2xl border border-white/10 p-4 text-[#a1a1aa]">Пока ничего не добавлено. Найдите фильмы или сериалы ниже.</div>}
        </form>
      </section>

      <div className="mt-6"><PartnerCatalogSearch collectionId={collection.id} /></div>

      <section className="mf-panel mt-6 p-5">
        <form action={partnerSubmitCollection}>
          <input type="hidden" name="id" value={collection.id} />
          <button className={partnerButton}>{partner.requireCollectionModeration ? "Отправить подборку на модерацию" : "Опубликовать подборку"}</button>
        </form>
      </section>
    </PartnerShell>
  );
}
