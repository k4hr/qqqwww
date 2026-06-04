import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionGrid } from "@/components/section-grid";
import { ContentType } from "@prisma/client";
import { ArrowRight, Crown, Sparkles, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [movies, series, cartoons, anime, genres] = await Promise.all([
    prisma.movie.findMany({ where: { type: ContentType.MOVIE, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.SERIES, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.CARTOON, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.movie.findMany({ where: { type: ContentType.ANIME, isPublished: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 18 }),
  ]);

  return (
    <div className="container py-6 md:py-8">
      <section className="vip-panel hero-backdrop grid-fade p-6 md:p-8 lg:p-10 mb-10 overflow-hidden">
        <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-8 items-center relative z-10">
          <div>
            <div className="vip-chip mb-5"><Crown size={16} /> Супер VIP кинотеатр</div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight max-w-4xl leading-[1.02]">
              MARIOFILM — <span className="gold-text">премиальный</span> кинотеатр нового уровня
            </h1>
            <p className="text-white/70 text-lg md:text-xl mt-5 max-w-3xl leading-relaxed">
              Не обычный кино-сайт, а ощущение приватного VIP-кинозала: тёмная люксовая атмосфера, премиальные подборки, рейтинги, трейлеры и быстрый доступ к карточкам фильмов, сериалов, мультфильмов и аниме.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/movies" className="rounded-full px-6 py-3.5 bg-gradient-to-r from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] font-bold hover:brightness-105 transition inline-flex items-center gap-2">
                Смотреть каталог <ArrowRight size={18} />
              </Link>
              <Link href="/top" className="rounded-full px-6 py-3.5 border border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.07] transition inline-flex items-center gap-2">
                <Star size={18} className="text-[#f0d79f]" /> ТОП подборка
              </Link>
            </div>

            {genres.length ? (
              <div className="flex flex-wrap gap-2 mt-7">
                {genres.map((genre) => (
                  <Link key={genre.slug} href={`/genre/${genre.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white hover:border-[#c9a86a]/25">
                    {genre.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="vip-soft-panel p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-[#f0d79f]/85 mb-2">Прямой вход</div>
              <div className="grid grid-cols-2 gap-3">
                <QuickCard href="/movies?year=2026" title="Фильмы 2026" sub="Громкие новинки" />
                <QuickCard href="/series?year=2026" title="Сериалы 2026" sub="Новые сезоны" />
                <QuickCard href="/top" title="ТОП 100" sub="Лучшее сейчас" />
                <QuickCard href="/latest" title="Обновления" sub="Свежие поступления" />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <StatCard value="VIP" label="визуальный стиль" />
              <StatCard value="4" label="основные разделы" />
              <StatCard value="24/7" label="доступ к каталогу" />
            </div>
          </div>
        </div>
      </section>

      <SectionGrid title="Фильмы" href="/movies" movies={movies} />
      <SectionGrid title="Сериалы" href="/series" movies={series} />
      <SectionGrid title="Мультфильмы" href="/cartoons" movies={cartoons} />
      {anime.length > 0 ? <SectionGrid title="Аниме" href="/anime" movies={anime} /> : null}
    </div>
  );
}

function QuickCard({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4 min-h-[110px] flex flex-col justify-between">
      <div className="text-sm text-white/55">{sub}</div>
      <div className="text-lg font-bold leading-tight">{title}</div>
    </Link>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="vip-soft-panel p-4 text-center">
      <div className="text-2xl font-black gold-text">{value}</div>
      <div className="text-sm text-white/55 mt-1 inline-flex items-center gap-2"><Sparkles size={14} className="text-[#5ed18c]" /> {label}</div>
    </div>
  );
}
