import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { PartnerTrack } from "@/components/partner-track";
import { prisma } from "@/lib/prisma";
import { siteUrl, watchPath } from "@/lib/seo-links";

export async function getCreatorHubMetadata(slug: string): Promise<Metadata | null> {
  const hub = await prisma.creatorHub.findUnique({ where: { slug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  return {
    title: `${hub.title} — REDFILM`,
    description: hub.description || "Авторские подборки фильмов и сериалов REDFILM.",
    alternates: { canonical: `/collections/${hub.slug}` },
    openGraph: { title: hub.title, description: hub.description || undefined, url: `/collections/${hub.slug}`, images: hub.coverUrl ? [{ url: hub.coverUrl }] : undefined },
  };
}

export async function getCreatorCollectionMetadata(partnerSlug: string, collectionSlug: string): Promise<Metadata | null> {
  const hub = await prisma.creatorHub.findUnique({ where: { slug: partnerSlug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  const collection = await prisma.creatorCollection.findFirst({ where: { hubId: hub.id, slug: collectionSlug, status: "PUBLISHED" } });
  if (!collection) return null;
  return {
    title: `${collection.title} — ${hub.title} — REDFILM`,
    description: collection.description || hub.description || "Авторская подборка REDFILM.",
    alternates: { canonical: `/collections/${hub.slug}/${collection.slug}` },
    openGraph: { title: collection.title, description: collection.description || undefined, url: `/collections/${hub.slug}/${collection.slug}`, images: collection.coverUrl || hub.coverUrl ? [{ url: collection.coverUrl || hub.coverUrl! }] : undefined },
  };
}

export async function renderCreatorHubPage(slug: string) {
  const hub = await prisma.creatorHub.findUnique({ where: { slug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  const partner = await prisma.partner.findUnique({ where: { id: hub.partnerId } });
  if (!partner || partner.status !== "ACTIVE") return null;
  const collections = await prisma.creatorCollection.findMany({ where: { hubId: hub.id, status: "PUBLISHED" }, orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  return (
    <div className="container py-6">
      <PartnerTrack type="AUTHOR_HUB_OPEN" partnerSlug={partner.slug} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: hub.title, url: siteUrl(`/collections/${hub.slug}`) }} />
      <section className="glass-panel section-glow overflow-hidden rounded-[26px] p-5 sm:p-7">
        {hub.coverUrl ? <div className="relative mb-5 h-44 overflow-hidden rounded-3xl"><Image src={hub.coverUrl} alt={hub.title} fill className="object-cover" unoptimized /></div> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {partner.avatarUrl ? <Image src={partner.avatarUrl} alt={partner.publicName || partner.name} width={92} height={92} className="rounded-full border border-white/10 object-cover" unoptimized /> : null}
          <div>
            <h1 className="text-3xl font-black text-white">{hub.title}</h1>
            <p className="mt-2 max-w-3xl text-[#a1a1aa]">{hub.description || partner.description || "Авторские подборки REDFILM."}</p>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => <Link key={collection.id} href={`/collections/${hub.slug}/${collection.slug}`} className="mf-panel block overflow-hidden p-5 hover:border-[#e50914]/50">{collection.coverUrl ? <div className="relative mb-4 h-36 overflow-hidden rounded-2xl"><Image src={collection.coverUrl} alt={collection.title} fill className="object-cover" unoptimized /></div> : null}<h2 className="text-xl font-black text-white">{collection.title}</h2><p className="mt-2 line-clamp-3 text-sm text-[#a1a1aa]">{collection.description || "Авторская подборка REDFILM."}</p></Link>)}
        {!collections.length ? <div className="mf-panel p-5 text-[#a1a1aa]">Опубликованных подборок пока нет.</div> : null}
      </section>
    </div>
  );
}

export async function renderCreatorCollectionPage(partnerSlug: string, collectionSlug: string) {
  const hub = await prisma.creatorHub.findUnique({ where: { slug: partnerSlug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  const partner = await prisma.partner.findUnique({ where: { id: hub.partnerId } });
  if (!partner || partner.status !== "ACTIVE") return null;
  const collection = await prisma.creatorCollection.findFirst({ where: { hubId: hub.id, slug: collectionSlug, status: "PUBLISHED" } });
  if (!collection) return null;
  const items = await prisma.creatorCollectionMovie.findMany({ where: { collectionId: collection.id }, orderBy: { position: "asc" } });
  const movies = await prisma.movie.findMany({ where: { id: { in: items.map((item) => item.movieId) }, isPublished: true, isCatalogAllowed: true }, include: { genres: { include: { genre: true } } } });
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));
  const ordered = items.map((item) => ({ item, movie: movieById.get(item.movieId) })).filter((entry) => entry.movie);

  return (
    <div className="container py-6">
      <PartnerTrack type="COLLECTION_OPEN" partnerSlug={partner.slug} collectionId={collection.id} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: collection.title, url: siteUrl(`/collections/${hub.slug}/${collection.slug}`), mainEntity: { "@type": "ItemList", itemListElement: ordered.map(({ movie }, index) => ({ "@type": "ListItem", position: index + 1, name: movie!.titleRu, url: siteUrl(watchPath(movie!)), image: movie!.posterUrl || undefined })) } }} />
      <section className="glass-panel section-glow overflow-hidden rounded-[26px] p-5 sm:p-7">
        {collection.coverUrl || hub.coverUrl ? <div className="relative mb-5 h-48 overflow-hidden rounded-3xl"><Image src={collection.coverUrl || hub.coverUrl!} alt={collection.title} fill className="object-cover" unoptimized /></div> : null}
        <Link href={`/collections/${hub.slug}`} className="text-sm font-bold text-[#ff4d55]">← {hub.title}</Link>
        <h1 className="mt-3 text-3xl font-black text-white">{collection.title}</h1>
        <p className="mt-3 max-w-4xl text-[#a1a1aa]">{collection.description || hub.description || "Авторская подборка REDFILM."}</p>
      </section>
      <section className="mt-6 grid gap-5">
        {ordered.map(({ item, movie }) => movie ? (
          <div key={item.id} className="grid gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
            <MovieCard movie={movie} />
            <div className="mf-panel p-5">
              <h2 className="text-2xl font-black text-white">{movie.titleRu}</h2>
              <div className="mt-2 text-sm text-[#a1a1aa]">{movie.year} · КП {movie.kpRating?.toFixed(1) ?? "—"} · IMDb {movie.imdbRating?.toFixed(1) ?? "—"}</div>
              {item.authorComment ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[#d4d4d8]"><b className="text-white">Почему советую:</b><br />{item.authorComment}</div> : null}
              <Link href={watchPath(movie)} className="mt-4 inline-flex rounded-xl bg-[#e50914] px-4 py-2 text-sm font-black text-white">Смотреть</Link>
            </div>
          </div>
        ) : null)}
      </section>
    </div>
  );
}
