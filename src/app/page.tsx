import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Film, Play } from "lucide-react";
import { ContentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { collectionLinksForYear } from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentYear = new Date().getFullYear();
  const [movies, series, cartoons, anime, genres] = await Promise.all([
    prisma.movie.findMany({ where: { type: ContentType.MOVIE, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.SERIES, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.CARTOON, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.ANIME, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 18 }),
  ]);

  const featured = movies[0] ?? series[0] ?? cartoons[0] ?? anime[0] ?? null;
  const quickLinks = [
    { label: `Фильмы ${currentYear}`, href: `/movies/${currentYear}` },
    { label: `Сериалы ${currentYear}`, href: `/series/${currentYear}` },
    { label: "ТОП100", href: "/collections/top-100" },
    { label: "Последние обновления", href: "/latest" },
    { label: "Подборки", href: "/collections" },
  ];
  const catalogLinks = collectionLinksForYear(currentYear);

  return (
    <div className="container py-4 sm:py-6">
      <section className="relative min-h-[510px] overflow-hidden rounded-[22px] border border-[#27272f] bg-[#101015] shadow-[0_30px_90px_rgba(0,0,0,.42)] sm:min-h-[550px]">
        {featured?.backdropUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${featured.backdropUrl})` }}
          />
        ) : (
          <div className="poster-fallback absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,12,.98)_0%,rgba(8,8,12,.86)_45%,rgba(8,8,12,.28)_100%)] max-md:bg-[linear-gradient(0deg,rgba(8,8,12,.98)_0%,rgba(8,8,12,.76)_65%,rgba(8,8,12,.35)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#08080c_0%,transparent_45%)]" />

        <div className="relative z-10 grid min-h-[510px] items-center gap-8 p-6 sm:min-h-[550px] sm:p-10 md:grid-cols-[minmax(0,1fr)_260px] lg:p-14 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="max-w-3xl self-end pb-2 md:self-center md:pb-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e50914]/40 bg-[#e50914]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#ff4d55]">
              <Film size={14} /> Кино начинается здесь
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              <span className="text-[#e50914]">REDFILM</span> — фильмы и сериалы онлайн
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#b3b3bd] sm:text-lg">
              Каталог фильмов, сериалов, мультфильмов и аниме с описаниями, рейтингами, трейлерами и подборками.
            </p>
            {featured ? (
              <p className="mt-5 text-sm font-bold text-white/85">
                Сейчас в каталоге: <Link href={`/movie/${featured.slug}`} className="text-white hover:text-[#ff4d55]">{featured.titleRu} · {featured.year}</Link>
              </p>
            ) : null}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/movies" className="mf-btn mf-btn-primary gap-2"><Play size={16} fill="currentColor" /> Смотреть каталог</Link>
              <Link href="/latest" className="mf-btn gap-2">Новинки <ArrowRight size={16} /></Link>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-[280px] md:block">
            <div className="absolute -inset-5 rounded-[28px] bg-[#e50914]/20 blur-3xl" />
            <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
              {featured?.posterUrl ? (
                <Image src={featured.posterUrl} alt={featured.titleRu} fill className="object-cover" sizes="300px" unoptimized priority />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[#71717a]">
                  <Film size={58} strokeWidth={1.3} />
                  <span className="text-sm font-black tracking-[0.22em]">REDFILM</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <nav className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-[#27272f] bg-[#101015] p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Быстрые ссылки">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="mf-pill hover:bg-[#e50914] hover:border-[#e50914]">{item.label}</Link>
        ))}
      </nav>

      {(catalogLinks.length > 0 || genres.length > 0) ? (
        <div className="mt-4 flex flex-wrap gap-2 px-1">
          {catalogLinks.map((item) => <Link key={item.href} href={item.href} className="text-xs font-medium text-[#71717a] transition-colors hover:text-white">{item.label}</Link>)}
          {genres.slice(0, 10).map((genre) => <Link key={genre.slug} href={`/genre/${genre.slug}/${currentYear}`} className="text-xs font-medium text-[#71717a] transition-colors hover:text-white">{genre.name} {currentYear}</Link>)}
        </div>
      ) : null}

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      <SectionGrid title="Аниме" href="/anime" movies={anime} />
    </div>
  );
}
