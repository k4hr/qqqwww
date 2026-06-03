import Link from "next/link";
import { Search, Sun, Play } from "lucide-react";

export function Header() {
  return (
    <header className="bg-white border-b border-mario-line sticky top-0 z-50">
      <div className="container h-[70px] flex items-center gap-8">
        <Link href="/" className="flex items-center gap-3 font-black text-2xl tracking-tight">
          <span className="w-9 h-9 rounded-md bg-mario-green text-white flex items-center justify-center">
            <Play size={22} fill="currentColor" />
          </span>
          <span>MARIOFILM</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7 text-sm font-bold uppercase text-neutral-500">
          <Link className="hover:text-mario-green" href="/movies">Фильмы</Link>
          <Link className="hover:text-mario-green" href="/series">Сериалы</Link>
          <Link className="hover:text-mario-green" href="/cartoons">Мультфильмы</Link>
          <Link className="hover:text-mario-green" href="/anime">Аниме</Link>
          <Link className="hover:text-mario-green" href="/latest">Последние</Link>
        </nav>

        <form action="/search" className="ml-auto hidden md:flex w-[330px] border border-mario-line bg-[#f8f8f8] h-9 items-center px-3">
          <input name="q" placeholder="Поиск по сайту..." className="bg-transparent flex-1 outline-none text-sm" />
          <Search size={18} className="text-mario-green" />
        </form>
        <button className="text-yellow-400" aria-label="theme"><Sun size={28} /></button>
      </div>
    </header>
  );
}
