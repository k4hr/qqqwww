import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

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
        ? "flex h-11 w-full items-center rounded-xl border border-[#27272f] bg-[#111117] px-4"
        : "ml-auto flex h-11 w-[290px] shrink-0 items-center rounded-xl border border-[#27272f] bg-[#111117] px-4 transition-colors focus-within:border-[#e50914] max-lg:w-[240px] max-md:hidden"}
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
    <header className="sticky top-0 z-50 border-b border-[#202027] bg-[#09090d]/95 shadow-[0_10px_30px_rgba(0,0,0,.24)] backdrop-blur-xl">
      <div className="container flex min-h-[72px] items-center gap-5 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3 text-xl font-black tracking-[-0.04em] text-white">
          <Image src="/logo-icon.png" alt="REDFILM" width={40} height={40} className="rounded-xl" priority />
          <span><span className="text-[#e50914]">RED</span>FILM</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-5 overflow-x-auto py-2 text-[13px] font-bold text-[#a1a1aa] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-xl:gap-4">
          {nav.map(([label, href]) => (
            <Link key={href} className="whitespace-nowrap transition-colors hover:text-white" href={href}>{label}</Link>
          ))}
        </nav>

        <SearchForm />
      </div>
      <div className="container pb-3 md:hidden"><SearchForm mobile /></div>
    </header>
  );
}
