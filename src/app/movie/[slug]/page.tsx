import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlayerBlock } from "@/components/player-block";
import { MovieCard } from "@/components/movie-card";
import { getContentTypeLabel, getContentTypePath } from "@/lib/content";
import { Clock3, Eye, Film, Heart, Star } from "lucide-react";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await prisma.movie.findUnique({ where: { slug } });
  if (!movie) return {};
  return {
    title: `${movie.titleRu} (${movie.year}) смотреть онлайн — MARIOFILM`,
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
    <div className="container py-6 md:py-8">
      <div className="text-sm text-white/45 mb-6">
        <Link href="/" className="hover:text-white">MARIOFILM</Link> · <Link href={getContentTypePath(movie.type)} className="hover:text-white">{getContentTypeLabel(movie.type)}</Link> · <span className="text-white/80">{movie.titleRu}</span>
      </div>

      <section className="vip-panel overflow-hidden">
        <div className="grid lg:grid-cols-[290px_1fr] gap-8 p-6 md:p-8">
          <div>
            <div className="relative aspect-[2/3] overflow-hidden rounded-[28px] border border-white/10 bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,.35)]">
              {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="290px" unoptimized /> : null}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                <span className="rounded-full border border-[#5ed18c]/30 bg-[#5ed18c]/15 px-3 py-1 text-xs font-bold text-[#baf1ce]">{movie.quality}</span>
                <span className="rounded-full border border-[#c9a86a]/25 bg-[#c9a86a]/12 px-3 py-1 text-xs font-bold text-[#f6dfaa] inline-flex items-center gap-1"><Star size={12} fill="currentColor" /> {movie.kpRating?.toFixed(1) ?? movie.tmdbRating?.toFixed(1) ?? "—"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <MiniMetric icon={<Heart size={16} className="text-[#5ed18c]" />} label="Лайки" value={String(movie.likes)} />
              <MiniMetric icon={<Eye size={16} className="text-[#f0d79f]" />} label="Просмотры" value={String(movie.views)} />
              <MiniMetric icon={<Clock3 size={16} className="text-sky-300" />} label="Год" value={String(movie.year)} />
            </div>
          </div>

          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">{movie.titleRu} <span className="text-white/45">({movie.year})</span></h1>
            {movie.titleOriginal ? <div className="text-white/45 mt-2 text-lg">{movie.titleOriginal}</div> : null}
            <p className="text-white/72 leading-relaxed mt-5 max-w-4xl">{movie.description}</p>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-7">
              <Info label="Страна" value={movie.country ?? "—"} />
              <Info label="Режиссёр" value={movie.director ?? "—"} />
              <Info label="Возраст" value={movie.ageRating ?? "—"} />
              <Info label="Качество" value={movie.quality} />
              <Info label="КП" value={movie.kpRating?.toFixed(1) ?? "—"} />
              <Info label="IMDb" value={movie.imdbRating?.toFixed(1) ?? "—"} />
              <Info label="TMDB" value={movie.tmdbRating?.toFixed(1) ?? "—"} />
              <Info label="Тип" value={<span className="inline-flex items-center gap-2"><Film size={15} className="text-[#f0d79f]" /> {getContentTypeLabel(movie.type)}</span>} />
              <Info label="Год выхода" value={<Link className="hover:text-white underline underline-offset-4 text-white/80" href={`/year/${movie.year}`}>{movie.year}</Link>} />
            </div>

            <div className="vip-soft-panel p-5 mt-6">
              <div className="text-sm font-semibold text-white/90 mb-2">Жанры</div>
              <div className="flex flex-wrap gap-2">
                {movie.genres.length ? movie.genres.map((item) => (
                  <Link key={item.genre.slug} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white hover:border-[#c9a86a]/25" href={`/genre/${item.genre.slug}`}>{item.genre.name}</Link>
                )) : <span className="text-white/55">—</span>}
              </div>
            </div>

            <div className="vip-soft-panel p-5 mt-4">
              <div className="text-sm font-semibold text-white/90 mb-2">В ролях</div>
              <div className="text-white/65 leading-relaxed">{movie.cast.map((item) => item.person.nameRu).join(", ") || "—"}</div>
            </div>
          </div>
        </div>
      </section>

      <PlayerBlock movie={movie} />

      <section className="mt-10">
        <div className="mb-5">
          <h2 className="text-2xl md:text-3xl font-black">Смотрите также</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {related.map((item) => <MovieCard key={item.slug} movie={item} />)}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vip-soft-panel p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-white/40 mb-1">{label}</div>
      <div className="text-white/85 font-medium">{value}</div>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="vip-soft-panel p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className="text-xs uppercase tracking-[0.22em] text-white/40">{label}</div>
      <div className="text-lg font-bold text-white/90 mt-1">{value}</div>
    </div>
  );
}
