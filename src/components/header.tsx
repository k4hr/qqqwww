import Link from "next/link";
import { Search, Play } from "lucide-react";

const nav = [
  ["Фильмы", "/movies"],
  ["Сериалы", "/series"],
  ["Мультфильмы", "/cartoons"],
  ["Аниме", "/anime"],
  ["Последние", "/latest"],
  ["ТОП", "/top"],
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09101b]/80 backdrop-blur-xl">
      <div className="container py-4 flex flex-col gap-4 xl:flex-row xl:items-center">
        <Link href="/" className="flex items-center gap-3 min-w-0 shrink-0">
          <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020] shadow-[0_10px_30px_rgba(201,168,106,.25)]">
            <Play size={22} fill="currentColor" />
          </span>
          <div className="text-3xl font-black tracking-tight gold-text leading-none">MARIOFILM</div>
        </Link>

        <nav className="flex-1 xl:justify-center flex items-center gap-3 xl:gap-5 overflow-x-auto whitespace-nowrap text-sm font-semibold text-white/80">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:border-[#c9a86a]/30 hover:text-white transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        <form action="/search" className="flex h-12 items-center rounded-full border border-white/10 bg-white/[0.05] px-4 w-full md:w-[320px] text-white/80">
          <Search size={18} className="text-[#f0d79f] mr-3 shrink-0" />
          <input
            name="q"
            placeholder="Поиск по сайту..."
            className="bg-transparent flex-1 outline-none text-sm placeholder:text-white/40"
          />
        </form>
      </div>
    </header>
  );
}
