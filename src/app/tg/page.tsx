<<<<<<< HEAD
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TgHomeRedirect() {
  redirect("/");
=======
import { ContentType } from "@prisma/client";
import { TgMovieCard } from "@/components/tg/tg-movie-card";
import { TgPersonalSections } from "@/components/tg/tg-personal-sections";
import { TgSearchBox } from "@/components/tg/tg-search-box";
import { prisma } from "@/lib/prisma";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { getTgLatestMovies, getTgPopularMovies, tgMovieInclude } from "@/lib/telegram/movies";

export const dynamic = "force-dynamic";

export default async function TgHomePage() {
  const [popular, latest, series, movies] = await Promise.all([
    getTgPopularMovies(8),
    getTgLatestMovies(8),
    prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, { type: ContentType.SERIES }] }, include: tgMovieInclude, orderBy: [{ popularScore: "desc" }, { homeScore: "desc" }], take: 6 }),
    prisma.movie.findMany({ where: { AND: [vibixPublicMovieWhere, { type: ContentType.MOVIE }] }, include: tgMovieInclude, orderBy: [{ popularScore: "desc" }, { homeScore: "desc" }], take: 6 }),
  ]);

  return (
    <div>
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(229,9,20,.35),transparent_38%),linear-gradient(145deg,#181820,#07070b)] p-5 shadow-[0_22px_70px_rgba(0,0,0,.5)]">
        <p className="text-xs font-black uppercase tracking-[.24em] text-[#ff4d55]">REDFILM</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">Фильмы и сериалы онлайн в Telegram</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#b7b7c0]">Ищите фильмы, открывайте карточки и смотрите через текущий плеер REDFILM.</p>
        <div className="mt-5"><TgSearchBox /></div>
      </section>

      <TgPersonalSections />
      <MovieSection title="Популярное" movies={popular} />
      <MovieSection title="Новинки" movies={latest} />
      <MovieSection title="Сериалы" movies={series} />
      <MovieSection title="Фильмы" movies={movies} />
    </div>
  );
}

function MovieSection({ title, movies }: { title: string; movies: React.ComponentProps<typeof TgMovieCard>["movie"][] }) {
  if (!movies.length) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xl font-black">{title}</h2>
      <div className="space-y-3">{movies.map((movie) => <TgMovieCard key={movie.id} movie={movie} />)}</div>
    </section>
  );
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
}
