import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Film, ThumbsDown, ThumbsUp } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlayerBlock } from "@/components/player-block";
import { MovieCard } from "@/components/movie-card";
import { getContentTypeLabel, getContentTypePath } from "@/lib/content";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findUnique({ where: { slug } });
  if (!movie) return {};
  return {
    title: `${movie.titleRu} (${movie.year}) смотреть онлайн — REDFILM`,
    description: movie.description,
  };
}

export default async function MoviePage({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findUnique({
    where: { slug },
    include: { genres: { include: { genre: true } }, cast: { include: { person: true }, orderBy: { sortOrder: "asc" } } }
  });

  if (!movie) notFound();

  const related = await prisma.movie.findMany({
    where: { id: { not: movie.id }, type: movie.type, isPublished: true },
    orderBy: [{ kpRating: "desc" }, { createdAt: "desc" }],
    take: 6
  });

  return (
    <div className="container py-5 sm:py-7">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[#71717a] sm:text-sm">
        <Link className="hover:text-white" href="/">REDFILM</Link><span>/</span>
        <Link className="hover:text-white" href={getContentTypePath(movie.type)}>{getContentTypeLabel(movie.type)}</Link><span>/</span>
        <span className="text-[#a1a1aa]">{movie.titleRu}</span>
      </div>

      <section className="cinema-glow mf-panel relative overflow-hidden p-4 sm:p-6 lg:p-7">
        {movie.backdropUrl ? <div className="absolute inset-x-0 top-0 h-80 bg-cover bg-center opacity-20 blur-sm" style={{ backgroundImage: `url(${movie.backdropUrl})` }} /> : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(229,9,20,.16),transparent_34%),linear-gradient(to_bottom,rgba(8,8,12,.55),#08080c_72%)]" />

        <div className="relative grid gap-7 md:grid-cols-[230px_1fr] lg:gap-10">
          <div>
            <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-[24px] border border-white/10 shadow-2xl">
              {movie.posterUrl ? (
                <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="230px" unoptimized priority />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#71717a]"><Film size={52} strokeWidth={1.3} /><span className="text-xs font-black tracking-[.2em]">REDFILM</span></div>
              )}
              <span className="mf-badge absolute left-3 top-3">{movie.quality || "HD"}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Rating label="КП" value={movie.kpRating?.toFixed(1)} className="rating-kp" />
              <Rating label="IMDb" value={movie.imdbRating?.toFixed(1)} className="rating-imdb" />
              <Rating label="TMDB" value={movie.tmdbRating?.toFixed(1)} className="text-white" />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs backdrop-blur">
              <span className="flex items-center gap-1.5 text-[#a1a1aa]"><ThumbsUp size={14} className="text-[#e50914]" /> {movie.likes}</span>
              <span className="flex items-center gap-1.5 text-[#71717a]"><ThumbsDown size={14} /> {movie.dislikes}</span>
            </div>
          </div>

          <div className="min-w-0 py-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="mf-badge">{getContentTypeLabel(movie.type)}</span>
              {movie.ageRating ? <span className="mf-pill min-h-[25px] px-2.5 text-[11px]">{movie.ageRating}</span> : null}
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-[-0.035em] text-white sm:text-4xl">{movie.titleRu} <span className="font-medium text-[#71717a]">({movie.year})</span></h1>
            {movie.titleOriginal ? <div className="mt-2 text-sm text-[#8b8b95]">{movie.titleOriginal}</div> : null}
            <p className="mt-5 max-w-4xl leading-relaxed text-[#b3b3bd]">{movie.description}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Страна" value={movie.country ?? "—"} />
              <Info label="Режиссёр" value={movie.director ?? "—"} />
              <Info label="Год выхода" value={<Link className="text-white hover:text-[#e50914]" href={`/year/${movie.year}`}>{movie.year}</Link>} />
              <Info label="Жанр" value={movie.genres.length ? <span>{movie.genres.map((item, index) => <span key={item.genre.slug}>{index ? ", " : ""}<Link className="text-white hover:text-[#e50914]" href={`/genre/${item.genre.slug}`}>{item.genre.name}</Link></span>)}</span> : "—"} />
              <Info label="Возраст" value={movie.ageRating ?? "—"} />
              <Info label="Качество" value={movie.quality} />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-[#a1a1aa] backdrop-blur">
              <b className="text-white">В ролях:</b> {movie.cast.map((item) => item.person.nameRu).join(", ") || "—"}
            </div>
          </div>
        </div>
      </section>

      <PlayerBlock movie={movie} />

      <section className="mf-panel mt-6 p-5 sm:p-6">
        <h2 className="text-xl font-bold text-white">Похожие фильмы и подборки</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/year/${movie.year}`} className="mf-btn">{movie.year} год</Link>
          <Link href={`${getContentTypePath(movie.type)}/${movie.year}`} className="mf-btn">{getContentTypeLabel(movie.type)} {movie.year}</Link>
          <Link href={`/similar/${movie.slug}`} className="mf-btn mf-btn-primary">Похожие фильмы</Link>
          {movie.genres.slice(0, 6).map((item) => <Link key={item.genre.slug} href={`/genre/${item.genre.slug}/${movie.year}`} className="mf-btn">{item.genre.name} {movie.year}</Link>)}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-5 flex items-center gap-3 text-2xl font-black text-white"><span className="h-7 w-1 rounded-full bg-[#e50914]" />Смотрите также</h2>
        {related.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 lg:gap-4">{related.map((item) => <MovieCard key={item.slug} movie={item} />)}</div>
        ) : (
          <div className="mf-panel p-8 text-center text-sm text-[#a1a1aa]">Похожие карточки пока не найдены.</div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3 backdrop-blur"><div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#71717a]">{label}</div><div className="text-sm text-[#d4d4d8]">{value}</div></div>;
}

function Rating({ label, value, className }: { label: string; value?: string; className: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 px-2 py-2 backdrop-blur"><div className={`font-black ${className}`}>{label}</div><div className="mt-0.5 font-bold text-white">{value ?? "—"}</div></div>;
}
