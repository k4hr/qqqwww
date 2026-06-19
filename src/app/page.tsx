import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Flame, Play, Sparkles, Star } from "lucide-react";
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
  const spotlight = [movies[1], series[0], cartoons[0]].flatMap((item) => item ? [item] : []);
  const quickLinks = [
    { label: `Фильмы ${currentYear}`, href: `/movies/${currentYear}` },
    { label: `Сериалы ${currentYear}`, href: `/series/${currentYear}` },
    { label: "ТОП100", href: "/collections/top-100" },
    { label: "Последние обновления", href: "/latest" },
    { label: "Подборки", href: "/collections" },
  ];
  const catalogLinks = collectionLinksForYear(currentYear);

  return (
    <div className="container py-5 sm:py-7">
      <section className="cinema-glow relative min-h-[560px] overflow-hidden rounded-[30px] border border-white/10 bg-[#09090d] sm:min-h-[620px]">
        <Image
          src="/redfilm-hero.png"
          alt=""
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        {featured?.backdropUrl ? (
          <div className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-screen" style={{ backgroundImage: `url(${featured.backdropUrl})` }} />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(229,9,20,.24),transparent_30%),linear-gradient(90deg,rgba(5,5,5,.98)_0%,rgba(5,5,5,.84)_42%,rgba(5,5,5,.18)_100%)] max-md:bg-[linear-gradient(0deg,rgba(5,5,5,.98)_4%,rgba(5,5,5,.72)_58%,rgba(5,5,5,.25)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />

        <div className="relative z-10 grid min-h-[560px] items-end gap-8 p-6 sm:min-h-[620px] sm:p-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center lg:p-14">
          <div className="max-w-3xl pb-4 lg:pb-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e50914]/45 bg-black/35 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#ff4d55] shadow-[0_0_28px_rgba(229,9,20,.2)] backdrop-blur-md">
              <Sparkles size={14} /> REDFILM cinematic
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              <span className="text-[#e50914] drop-shadow-[0_0_24px_rgba(229,9,20,.35)]">REDFILM</span> — фильмы и сериалы онлайн
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#d4d4d8] sm:text-lg">
              Каталог фильмов, сериалов, мультфильмов и аниме с описаниями, рейтингами, трейлерами и подборками.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/movies" className="mf-btn mf-btn-primary gap-2"><Play size={16} fill="currentColor" /> Смотреть сейчас</Link>
              <Link href="/top" className="mf-btn gap-2">Популярное <ArrowRight size={16} /></Link>
            </div>
            {featured ? (
              <div className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#d8a84f]">
                  <Star size={14} fill="currentColor" /> В фокусе
                </div>
                <Link href={`/movie/${featured.slug}`} className="text-lg font-black text-white transition-colors hover:text-[#ff4d55]">{featured.titleRu} · {featured.year}</Link>
                <p className="mt-1 text-sm text-[#a1a1aa]">КП {featured.kpRating?.toFixed(1) ?? "—"} · IMDb {featured.imdbRating?.toFixed(1) ?? "—"}</p>
              </div>
            ) : null}
          </div>

          <div className="hidden lg:block">
            <div className="rounded-[26px] border border-white/10 bg-black/35 p-4 shadow-2xl backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black text-white"><Flame size={17} className="text-[#e50914]" /> Сейчас в каталоге</span>
                <Link href="/latest" className="text-xs font-bold text-[#e50914] hover:text-white">Все</Link>
              </div>
              <div className="space-y-3">
                {spotlight.length ? spotlight.map((item) => (
                  <Link key={item.slug} href={`/movie/${item.slug}`} className="group grid grid-cols-[56px_1fr] gap-3 rounded-2xl border border-white/8 bg-white/[.045] p-2 transition-all hover:border-[#e50914]/60 hover:bg-white/[.075]">
                    <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-xl">
                      {item.posterUrl ? <Image src={item.posterUrl} alt={item.titleRu} fill className="object-cover" sizes="56px" unoptimized /> : null}
                    </div>
                    <div className="min-w-0 py-1">
                      <div className="line-clamp-2 text-sm font-bold leading-5 text-white group-hover:text-[#ff4d55]">{item.titleRu}</div>
                      <div className="mt-1 text-xs text-[#8b8b95]">{item.year} · {item.quality}</div>
                    </div>
                  </Link>
                )) : <div className="rounded-2xl border border-white/8 bg-white/[.045] p-4 text-sm text-[#a1a1aa]">Карточки появятся после импорта.</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-white/[.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Быстрые ссылки">
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
