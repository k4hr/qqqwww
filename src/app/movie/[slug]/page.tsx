import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlayerBlock } from "@/components/player-block";
import { MovieCard } from "@/components/movie-card";

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
    orderBy: { createdAt: "desc" },
    take: 6
  });

  return (
    <div className="container py-4">
      <div className="text-sm text-neutral-500 mb-6">
        <Link href="/">МариоФильм</Link> » <Link href="/movies">Фильмы</Link> » {movie.titleRu} {movie.year} смотреть онлайн
      </div>

      <section className="grid md:grid-cols-[220px_1fr] gap-6 bg-white border border-mario-line p-4 md:p-5">
        <div>
          <div className="relative aspect-[2/3] bg-neutral-200 overflow-hidden border border-mario-line">
            {movie.posterUrl ? <Image src={movie.posterUrl} alt={movie.titleRu} fill className="object-cover" sizes="220px" /> : null}
            <span className="absolute top-3 left-3 bg-mario-green text-white text-xs font-bold px-3 py-1 rounded-sm">{movie.quality}</span>
          </div>
          <div className="flex items-center justify-center -mt-6 relative z-10">
            <div className="w-16 h-16 rounded-full bg-white shadow-card flex items-center justify-center text-lg font-medium">{movie.kpRating?.toFixed(1) ?? "—"}</div>
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-mario-green font-bold">👍 {movie.likes}</span>
            <span className="text-red-500 font-bold">👎 {movie.dislikes}</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-medium mb-3">{movie.titleRu} ({movie.year})</h1>
          <p className="text-neutral-600 leading-relaxed mb-5">{movie.description}</p>

          <div className="grid md:grid-cols-3 gap-x-8 gap-y-4 text-sm">
            <Info label="Страна" value={movie.country ?? "—"} />
            <Info label="Режиссёр" value={movie.director ?? "—"} />
            <Info label="Жанр" value={movie.genres.map((item) => item.genre.name).join(" / ") || "—"} />
            <Info label="Год выхода" value={String(movie.year)} />
            <Info label="Возраст" value={movie.ageRating ?? "—"} />
            <Info label="Качество" value={movie.quality} />
            <Info label="КП" value={movie.kpRating?.toFixed(1) ?? "—"} />
            <Info label="IMDb" value={movie.imdbRating?.toFixed(1) ?? "—"} />
            <Info label="TMDB" value={movie.tmdbRating?.toFixed(1) ?? "—"} />
          </div>

          <div className="mt-5 text-sm"><b>В ролях актёры:</b> {movie.cast.map((item) => item.person.nameRu).join(", ") || "—"}</div>
        </div>
      </section>

      <PlayerBlock movie={movie} />

      <section className="mt-8 bg-[#0f0f0f] text-white p-5">
        <h2 className="text-xl font-bold mb-5">Смотрите также:</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {related.map((item) => <MovieCard key={item.slug} movie={item} />)}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="font-bold">{label}:</span> <span className="text-neutral-700">{value}</span></div>;
}
