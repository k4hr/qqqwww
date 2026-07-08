import Image from "next/image";
import Link from "next/link";
import { Film, Play, Search } from "lucide-react";
import type { TvMovie } from "@/lib/tv";
import { tvMoviePath, tvPlayerPath, tvPoster, tvTypeLabel } from "@/lib/tv";

export function TvShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_0%,rgba(229,9,20,.32),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(128,0,12,.24),transparent_28%),linear-gradient(180deg,#09090d,#050507_42%,#020203)]" />
      {children}
    </main>
  );
}

export function TvTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 px-10 py-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-6">
        <Link data-tv-focus data-tv-autofocus href="/msx" className="rounded-2xl px-2 py-1 text-4xl font-black tracking-[-.05em] text-[#ff1828] outline-none transition focus:bg-white focus:text-black">REDFILM</Link>
        <nav className="flex items-center gap-3 text-lg font-bold text-white/80">
          <Link data-tv-focus href="/msx" className="tv-pill">Главная</Link>
          <Link data-tv-focus href="/msx/search" className="tv-pill"><Search size={20} /> Поиск</Link>
          <Link data-tv-focus href="/" className="tv-pill">Обычный сайт</Link>
        </nav>
      </div>
    </header>
  );
}

export function TvHero({ movie }: { movie: TvMovie }) {
  const backdrop = movie.backdropUrl || movie.posterUrl;
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;
  return (
    <section className="relative min-h-[520px] overflow-hidden px-10 py-14">
      {backdrop ? <Image src={backdrop} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-34" unoptimized priority /> : null}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#050507_0%,rgba(5,5,7,.92)_34%,rgba(5,5,7,.35)_70%,#050507_100%)]" />
      <div className="max-w-4xl pt-10">
        <div className="mb-5 flex flex-wrap gap-3 text-lg font-black uppercase tracking-[.14em] text-[#ff4d55]"><span>REDFILM TV</span><span>•</span><span>{tvTypeLabel(movie.type)}</span><span>•</span><span>{movie.year}</span></div>
        <h1 className="text-[clamp(3rem,7vw,6.8rem)] font-black leading-[.9] tracking-[-.06em]">{movie.titleRu}</h1>
        <p className="mt-6 line-clamp-3 max-w-3xl text-2xl leading-snug text-white/76">{movie.description || "Смотрите онлайн в REDFILM TV."}</p>
        <div className="mt-7 flex flex-wrap items-center gap-4 text-xl text-white/80">
          {rating ? <span className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 font-black">★ {rating.toFixed(1)}</span> : null}
          {movie.duration ? <span>{movie.duration} мин.</span> : null}
          {movie.genres.slice(0, 3).map((item) => <span key={item.genreId}>{item.genre.name}</span>)}
        </div>
        <div className="mt-10 flex gap-4">
          <Link data-tv-focus href={tvPlayerPath(movie)} className="tv-cta"><Play fill="currentColor" /> Смотреть</Link>
          <Link data-tv-focus href={tvMoviePath(movie)} className="tv-cta tv-cta-secondary">Подробнее</Link>
        </div>
      </div>
    </section>
  );
}

export function TvSection({ title, movies }: { title: string; movies: TvMovie[] }) {
  if (!movies.length) return null;
  return (
    <section className="px-10 py-8">
      <h2 className="mb-5 text-4xl font-black tracking-[-.04em]">{title}</h2>
      <div className="grid grid-flow-col auto-cols-[210px] gap-5 overflow-x-auto pb-5 [scrollbar-width:none]">
        {movies.map((movie) => <TvPosterCard key={movie.id} movie={movie} />)}
      </div>
    </section>
  );
}

export function TvPosterGrid({ movies }: { movies: TvMovie[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6 px-10 pb-12">
      {movies.map((movie) => <TvPosterCard key={movie.id} movie={movie} />)}
    </div>
  );
}

export function TvPosterCard({ movie }: { movie: TvMovie }) {
  const poster = tvPoster(movie);
  const rating = movie.kpRating ?? movie.imdbRating ?? movie.tmdbRating;
  return (
    <Link data-tv-focus href={tvMoviePath(movie)} className="group block rounded-[26px] border border-white/10 bg-white/[.045] p-3 outline-none transition duration-200 focus:scale-[1.08] focus:border-[#ff2636] focus:bg-white focus:text-black focus:shadow-[0_0_0_6px_rgba(229,9,20,.34),0_24px_90px_rgba(229,9,20,.28)]">
      <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-[20px] bg-[#111118]">
        {poster ? <Image src={poster} alt={movie.titleRu} fill sizes="240px" className="object-cover" unoptimized /> : <div className="absolute inset-0 flex items-center justify-center text-white/30"><Film size={54} /></div>}
        <div className="absolute left-2 top-2 rounded-xl bg-black/70 px-2.5 py-1 text-sm font-black text-white">{movie.year}</div>
        {rating ? <div className="absolute right-2 top-2 rounded-xl bg-[#e50914] px-2.5 py-1 text-sm font-black text-white">{rating.toFixed(1)}</div> : null}
      </div>
      <div className="mt-3 min-h-[58px]">
        <h3 className="line-clamp-2 text-xl font-black leading-tight tracking-[-.03em]">{movie.titleRu}</h3>
        <p className="mt-1 truncate text-sm font-bold text-current/60">{tvTypeLabel(movie.type)}</p>
      </div>
    </Link>
  );
}

export function TvCss() {
  return (
    <style>{`
      .tv-pill{display:inline-flex;align-items:center;gap:.5rem;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);padding:.85rem 1.1rem;outline:none;transition:.18s ease;color:rgba(255,255,255,.84)}
      .tv-pill:focus{background:white;color:black;transform:scale(1.06);box-shadow:0 0 0 5px rgba(229,9,20,.32)}
      .tv-cta{display:inline-flex;align-items:center;gap:.8rem;border-radius:999px;background:#e50914;color:white;padding:1.1rem 1.8rem;font-size:1.35rem;font-weight:1000;outline:none;box-shadow:0 20px 70px rgba(229,9,20,.32);transition:.18s ease}
      .tv-cta:focus{background:white;color:black;transform:scale(1.08);box-shadow:0 0 0 6px rgba(229,9,20,.38),0 26px 90px rgba(255,255,255,.18)}
      .tv-cta-secondary{background:rgba(255,255,255,.12);box-shadow:none;border:1px solid rgba(255,255,255,.14)}
      .poster-fallback{background:linear-gradient(145deg,#191923,#08080b)}
      input.tv-input{height:72px;border-radius:24px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.44);padding:0 24px;color:white;font-size:28px;font-weight:800;outline:none;min-width:0;width:100%}
      input.tv-input:focus{border-color:#ff2636;box-shadow:0 0 0 6px rgba(229,9,20,.28);background:white;color:black}
      .vibix-player-shell{min-height:calc(100vh - 96px)!important;height:calc(100vh - 96px)!important;border-radius:0!important}
      .vibix-player-shell iframe{height:calc(100vh - 96px)!important}
      @media (max-width: 900px){.tv-pill{padding:.65rem .9rem}.tv-cta{font-size:1.1rem}.vibix-player-shell,.vibix-player-shell iframe{min-height:70vh!important;height:70vh!important}}
    `}</style>
  );
}
