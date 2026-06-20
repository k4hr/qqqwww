import Link from "next/link";
import { Search } from "lucide-react";
import { NAV_COUNTRIES, NAV_GENRES, NAV_YEARS, catalogHref } from "@/lib/navigation-data";

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-2 md:grid-cols-[100px_minmax(0,1fr)] md:items-center"><div className="text-xs font-black uppercase tracking-[.14em] text-[#e50914]">{label}</div><div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div></div>;
}

export function HomeCatalogTools() {
  return <section className="mf-panel mt-5 overflow-hidden p-4 sm:p-5">
    <form action="/search" className="relative flex min-w-0 items-center">
      <Search className="pointer-events-none absolute left-4 text-[#e50914]" size={20} />
      <input name="q" className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 py-3 pl-12 pr-4 text-base text-white outline-none focus:border-[#e50914] sm:h-14" placeholder="Найти фильм или сериал..." aria-label="Поиск по каталогу" />
      <button className="mf-btn mf-btn-primary ml-2 shrink-0 max-sm:px-4" type="submit">Найти</button>
    </form>
    <div className="mt-5 grid gap-3">
      <FilterRow label="Тип"><Link href="/latest" className="mf-pill min-h-11 shrink-0">Все</Link><Link href="/movies" className="mf-pill min-h-11 shrink-0">Фильмы</Link><Link href="/series" className="mf-pill min-h-11 shrink-0">Сериалы</Link></FilterRow>
      <FilterRow label="Год">{NAV_YEARS.map((item) => <Link key={item.value} href={catalogHref("/movies", "year", item.value)} className="mf-pill min-h-11 shrink-0">{item.label}</Link>)}</FilterRow>
      <FilterRow label="Жанр">{NAV_GENRES.slice(0, 12).map((item) => <Link key={item.value} href={catalogHref("/movies", "genre", item.value)} className="mf-pill min-h-11 shrink-0">{item.label}</Link>)}</FilterRow>
      <FilterRow label="Страна"><Link href="/movies?country=main" className="mf-pill min-h-11 shrink-0">Основной каталог</Link>{NAV_COUNTRIES.slice(0, 8).map((item) => <Link key={item.value} href={catalogHref("/movies", "country", item.value)} className="mf-pill min-h-11 shrink-0">{item.label}</Link>)}</FilterRow>
      <FilterRow label="Сортировка"><Link href="/movies?sort=popular" className="mf-pill min-h-11 shrink-0">Популярные</Link><Link href="/movies?sort=new" className="mf-pill min-h-11 shrink-0">Новинки</Link><Link href="/movies?sort=rating" className="mf-pill min-h-11 shrink-0">По рейтингу</Link></FilterRow>
    </div>
  </section>;
}
