import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlayerBlock } from "@/components/player-block";
import { VibixBanner } from "@/components/vibix-banner";
import { vibixPublicMovieWhere } from "@/lib/movie-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findFirst({ where: { slug, isPublished: true } });
  if (!movie) return {};
  return { title: `Смотреть ${movie.titleRu} (${movie.year}) — REDFILM`, description: movie.description };
}

export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findFirst({
    where: {
      slug,
      ...vibixPublicMovieWhere,
    },
  });
  if (!movie) notFound();

  return (
    <div className="container py-5 sm:py-7">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[#7d7d87]">
        <Link href="/" className="hover:text-white">REDFILM</Link><span>/</span>
        <Link href={`/movie/${movie.slug}`} className="hover:text-white">{movie.titleRu}</Link><span>/</span>
        <span className="text-[#b5b5bd]">Просмотр</span>
      </div>

      <section className="glass-panel section-glow relative overflow-hidden rounded-[26px] p-4 sm:p-6">
        {movie.backdropUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url(${movie.backdropUrl})` }} /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,9,.98),rgba(6,6,9,.82),rgba(65,0,6,.36))]" />
        <div className="relative grid items-center gap-5 sm:grid-cols-[110px_1fr]">
          <div className="poster-fallback relative hidden aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 sm:block">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="110px" unoptimized /> : <div className="absolute inset-0 flex items-center justify-center text-[#666670]"><Film /></div>}
          </div>
          <div>
            <span className="mf-badge">{movie.quality || "HD"}</span>
            <h1 className="mt-3 text-2xl font-black tracking-[-.03em] text-white sm:text-4xl">{movie.titleRu} <span className="font-medium text-[#777781]">({movie.year})</span></h1>
            <p className="line-clamp-2 mt-3 max-w-3xl text-sm leading-relaxed text-[#b9b9c0]">{movie.description}</p>
            <Link href={`/movie/${movie.slug}`} className="mt-4 inline-flex text-sm font-bold text-[#ff4d55] hover:text-white">Описание и подробности</Link>
          </div>
        </div>
      </section>

      <PlayerBlock movie={movie} />
      <VibixBanner size="680x200" />
    </div>
  );
}
