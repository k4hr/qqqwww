import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { MovieCard } from "@/components/movie-card";
import { PartnerTrack } from "@/components/partner-track";
import { prisma } from "@/lib/prisma";
import { siteUrl, watchPath } from "@/lib/seo-links";

type PosterCollageMovie = { id: string; posterUrl: string | null; titleRu: string };

function PosterCollage({ movies, title, className = "" }: { movies: PosterCollageMovie[]; title: string; className?: string }) {
  const posters = movies.filter((movie) => movie.posterUrl).slice(0, 5);
  if (!posters.length) return null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(229,9,20,.20),transparent_42%),#08080c] ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,8,.86),rgba(5,5,8,.26),rgba(5,5,8,.92))]" />
      <div className="relative grid h-full grid-cols-5 items-center gap-2 p-3">
        {posters.map((movie, index) => (
          <div key={movie.id} className={`poster-fallback relative aspect-[2/3] overflow-hidden rounded-xl shadow-[0_16px_38px_rgba(0,0,0,.5)] ${index === 0 ? "col-span-5 mx-auto h-[92%] w-[44%] sm:col-span-2 sm:h-auto sm:w-auto sm:scale-105" : "col-span-1 max-sm:hidden"}`}>
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={`${title}: ${movie.titleRu}`} fill className="object-cover" sizes="(max-width: 640px) 44vw, 180px" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function getCreatorHubMetadata(slug: string): Promise<Metadata | null> {
  const hub = await prisma.creatorHub.findUnique({ where: { slug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  const partner = await prisma.partner.findUnique({ where: { id: hub.partnerId } }).catch(() => null);
  if (!partner || partner.status !== "ACTIVE") return null;
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
  const partner = await prisma.partner.findUnique({ where: { id: hub.partnerId } }).catch(() => null);
  if (!partner || partner.status !== "ACTIVE") return null;
  const collection = await prisma.creatorCollection.findFirst({ where: { hubId: hub.id, slug: collectionSlug, status: "PUBLISHED" } });
  if (!collection) return null;
  const firstItem = await prisma.creatorCollectionMovie.findFirst({
    where: { collectionId: collection.id },
    orderBy: { position: "asc" },
    select: { movieId: true },
  });
  const firstMovie = firstItem
    ? await prisma.movie.findUnique({ where: { id: firstItem.movieId }, select: { posterUrl: true } })
    : null;
  return {
    title: `${collection.title} — ${hub.title} — REDFILM`,
    description: collection.description || hub.description || "Авторская подборка REDFILM.",
    alternates: { canonical: `/collections/${hub.slug}/${collection.slug}` },
    openGraph: { title: collection.title, description: collection.description || undefined, url: `/collections/${hub.slug}/${collection.slug}`, images: firstMovie?.posterUrl ? [{ url: firstMovie.posterUrl }] : undefined },
  };
}

export async function renderCreatorHubPage(slug: string) {
  const hub = await prisma.creatorHub.findUnique({ where: { slug } }).catch(() => null);
  if (!hub?.isPublished) return null;
  const partner = await prisma.partner.findUnique({ where: { id: hub.partnerId } });
  if (!partner || partner.status !== "ACTIVE") return null;
  const collections = await prisma.creatorCollection.findMany({ where: { hubId: hub.id, status: "PUBLISHED" }, orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  const firstItems = collections.length
    ? await prisma.creatorCollectionMovie.findMany({
        where: { collectionId: { in: collections.map((collection) => collection.id) } },
        orderBy: [{ collectionId: "asc" }, { position: "asc" }],
        select: { collectionId: true, movieId: true },
      })
    : [];
  const movieIdsByCollection = new Map<string, string[]>();
  for (const item of firstItems) {
    const ids = movieIdsByCollection.get(item.collectionId) ?? [];
    if (ids.length < 5) ids.push(item.movieId);
    movieIdsByCollection.set(item.collectionId, ids);
  }
  const coverMovieIds = Array.from(new Set([...movieIdsByCollection.values()].flat()));
  const coverMovies = coverMovieIds.length
    ? await prisma.movie.findMany({
        where: { id: { in: coverMovieIds } },
        select: { id: true, posterUrl: true, titleRu: true },
      })
    : [];
  const coverMovieById = new Map(coverMovies.map((movie) => [movie.id, movie]));
  return (
    <div className="container py-6">
      <PartnerTrack type="AUTHOR_HUB_OPEN" partnerSlug={partner.slug} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: hub.title, url: siteUrl(`/collections/${hub.slug}`) }} />
      <section className="creator-collection-hero glass-panel section-glow min-w-0 overflow-hidden rounded-[22px] p-4 sm:rounded-[26px] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {partner.avatarUrl ? <Image src={partner.avatarUrl} alt={partner.publicName || partner.name} width={92} height={92} className="rounded-full border border-white/10 object-cover" unoptimized /> : null}
          <div>
            <h1 className="text-3xl font-black text-white">{hub.title}</h1>
            <p className="mt-2 max-w-3xl text-[#a1a1aa]">{hub.description || partner.description || "Авторские подборки REDFILM."}</p>
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => {
          const collageMovies = (movieIdsByCollection.get(collection.id) ?? []).map((id) => coverMovieById.get(id)).filter((movie): movie is PosterCollageMovie => Boolean(movie));
          return (
            <Link key={collection.id} href={`/collections/${hub.slug}/${collection.slug}`} className="mf-panel block overflow-hidden p-5 hover:border-[#e50914]/50">
              <PosterCollage movies={collageMovies} title={collection.title} className="mb-4 aspect-[16/9]" />
              <h2 className="text-xl font-black text-white">{collection.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-[#a1a1aa]">{collection.description || "Авторская подборка REDFILM."}</p>
            </Link>
          );
        })}
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
    <div className="creator-collection-page container py-4 sm:py-6">
      <PartnerTrack type="COLLECTION_OPEN" partnerSlug={partner.slug} collectionId={collection.id} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: collection.title, url: siteUrl(`/collections/${hub.slug}/${collection.slug}`), mainEntity: { "@type": "ItemList", itemListElement: ordered.map(({ movie }, index) => ({ "@type": "ListItem", position: index + 1, name: movie!.titleRu, url: siteUrl(watchPath(movie!)), image: movie!.posterUrl || undefined })) } }} />
      <section className="glass-panel section-glow overflow-hidden rounded-[26px] p-5 sm:p-7">
        <PosterCollage movies={ordered.map(({ movie }) => movie!).filter(Boolean)} title={collection.title} className="mb-5 h-[220px] sm:h-[320px]" />
        <Link href={`/collections/${hub.slug}`} className="text-sm font-bold text-[#ff4d55]">← {hub.title}</Link>
        <h1 className="creator-collection-title mt-3 min-w-0 break-words text-[clamp(1.65rem,7vw,2.25rem)] font-black leading-tight text-white">{collection.title}</h1>
        <p className="creator-collection-description mt-3 max-w-4xl whitespace-pre-line break-words text-sm leading-6 text-[#a1a1aa] sm:text-base sm:leading-7">{collection.description || hub.description || "Авторская подборка REDFILM."}</p>
      </section>
      <section className="creator-collection-list mt-4 grid min-w-0 gap-4 sm:mt-6 sm:gap-5">
        {ordered.map(({ item, movie }) => {
          if (!movie) return null;

          const authorComment = item.authorComment?.trim();
          const fallbackDescription = movie.description?.trim();
          const displayText = authorComment || fallbackDescription;

          return (
            <article key={item.id} className="creator-collection-item grid min-w-0 items-start gap-3 sm:gap-4 md:grid-cols-[190px_minmax(0,1fr)]">
              <div className="creator-collection-poster min-w-0 overflow-hidden"><MovieCard movie={movie} /></div>
              <div className="creator-collection-details mf-panel min-w-0 self-start overflow-hidden p-4 sm:p-5">
                <h2 className="creator-collection-movie-title min-w-0 break-words text-[clamp(1.35rem,6vw,1.75rem)] font-black leading-tight text-white">{movie.titleRu}</h2>
                <div className="creator-collection-meta mt-2 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-sm text-[#a1a1aa]"><span>{movie.year}</span><span>· КП {movie.kpRating?.toFixed(1) ?? "—"}</span><span>· IMDb {movie.imdbRating?.toFixed(1) ?? "—"}</span></div>
                {displayText ? (
                  <div className="creator-collection-comment mt-4 min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-[#d4d4d8] sm:p-4">
                    {authorComment ? <div className="mb-2 font-black text-white">Почему советую</div> : null}
                    <p className="creator-collection-comment-text whitespace-pre-line break-words text-[15px] leading-6 sm:text-base sm:leading-7">{displayText}</p>
                  </div>
                ) : null}
                <Link href={watchPath(movie)} className="creator-collection-watch mt-4 inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-[#e50914] px-5 py-2.5 text-sm font-black text-white">Смотреть</Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
