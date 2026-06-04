import Link from "next/link";
import { Search, Play } from "lucide-react";

const nav = [
  ["Фильмы", "/movies"],
  ["Сериалы", "/series"],
  ["Мультфильмы", "/cartoons"],
  ["Аниме", "/anime"],
  ["Последнее", "/latest"],
  ["ТОП", "/top"],
] as const;

export function Header() {
  return (
    <header className="bg-white border-b border-[#dcdcdc] sticky top-0 z-50 shadow-sm">
      <div className="container min-h-[70px] py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 font-black text-2xl tracking-tight shrink-0">
          <span className="w-10 h-10 rounded-md bg-[#e50914] text-white flex items-center justify-center">
            <Play size={22} fill="currentColor" />
          </span>
          <span className="text-[#161616]">MARIOFILM</span>
        </Link>

        <nav className="flex items-center gap-6 overflow-x-auto text-sm font-bold uppercase text-neutral-500 shrink-0">
          {nav.map(([label, href]) => (
            <Link key={href} className="hover:text-[#e50914] whitespace-nowrap" href={href}>{label}</Link>
          ))}
        </nav>

        <form action="/search" className="ml-auto flex w-[360px] shrink-0 border border-[#d8d8d8] bg-[#f8f8f8] h-10 items-center px-3 max-lg:w-[280px] max-md:hidden">
          <input name="q" placeholder="Поиск по сайту..." className="bg-transparent flex-1 outline-none text-sm text-[#333] placeholder:text-[#9a9a9a]" />
          <Search size={18} className="text-[#e50914]" />
        </form>
      </div>

      <div className="container pb-3 md:hidden">
        <form action="/search" className="flex w-full border border-[#d8d8d8] bg-[#f8f8f8] h-10 items-center px-3">
          <input name="q" placeholder="Поиск по сайту..." className="bg-transparent flex-1 outline-none text-sm text-[#333] placeholder:text-[#9a9a9a]" />
          <Search size={18} className="text-[#e50914]" />
        </form>
      </div>
    </header>
  );
}
