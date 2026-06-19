import Image from "next/image";
import Link from "next/link";
import { Clapperboard, Search } from "lucide-react";

const nav = [
  ["Фильмы", "/movies"],
  ["Сериалы", "/series"],
  ["Мультфильмы", "/cartoons"],
  ["Аниме", "/anime"],
  ["Последнее", "/latest"],
  ["ТОП", "/top"],
] as const;

function SearchForm({ mobile = false }: { mobile?: boolean }) {
  return (
    <form
      action="/search"
      className={mobile
        ? "flex h-11 w-full items-center rounded-2xl border border-white/10 bg-white/[.045] px-4 shadow-inner shadow-black/30"
        : "ml-auto flex h-11 w-[310px] shrink-0 items-center rounded-2xl border border-white/10 bg-white/[.045] px-4 shadow-inner shadow-black/30 transition-all focus-within:border-[#e50914]/80 focus-within:bg-white/[.07] max-lg:w-[240px] max-md:hidden"}
    >
      <input
        name="q"
        aria-label="Поиск по сайту"
        placeholder="Фильм или сериал"
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#71717a]"
      />
      <Search size={18} className="shrink-0 text-[#e50914]" />
    </form>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050507]/82 shadow-[0_18px_60px_rgba(0,0,0,.38)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#e50914]/70 to-transparent" />
      <div className="container flex min-h-[76px] items-center gap-5 py-3">
        <Link href="/" className="group flex shrink-0 items-center gap-3 text-xl font-black tracking-[-0.04em] text-white">
          <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#e50914]/30 bg-[#e50914]/12 shadow-[0_0_28px_rgba(229,9,20,.28)]">
            <Image src="/logo-icon.png" alt="" fill className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-110" priority />
          </span>
          <span className="leading-none"><span className="text-[#e50914]">RED</span>FILM</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/[.07] bg-white/[.035] p-1 text-[13px] font-bold text-[#a1a1aa] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-xl:gap-1">
          {nav.map(([label, href]) => (
            <Link key={href} className="whitespace-nowrap rounded-full px-3.5 py-2 transition-all hover:bg-white/[.07] hover:text-white" href={href}>{label}</Link>
          ))}
        </nav>

        <SearchForm />
      </div>
      <div className="container pb-3 md:hidden">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#71717a]">
          <Clapperboard size={14} className="text-[#e50914]" /> REDFILM
        </div>
        <SearchForm mobile />
      </div>
    </header>
  );
}
