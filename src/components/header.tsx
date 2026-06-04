import Link from "next/link";
import { Search, Sun, Play } from "lucide-react";

export function Header() {
  return (
    <header className="bg-white border-b border-mario-line sticky top-0 z-50">
      <div className="container min-h-[70px] py-3 flex flex-wrap items-center gap-4 lg:gap-8">
        <Link href="/" className="flex items-center gap-3 font-black text-2xl tracking-tight">
          <span className="w-9 h-9 rounded-md bg-mario-green text-white flex items-center justify-center">
            <Play size={22} fill="currentColor" />
          </span>
          <span>MARIOFILM</span>
        </Link>

        <nav className="order-3 w-full lg:order-none lg:w-auto flex items-center gap-4 md:gap-7 overflow-x-auto text-sm font-bold uppercase text-neutral-500">
          <Link className="hover:text-mario-green whitespace-nowrap" href="/movies">Фильмы</Link>
          <Link className="hover:text-mario-green whitespace-nowrap" href="/series">Сериалы</Link>
          <Link className="hover:text-mario-green whitespace-nowrap" href="/cartoons">Мультфильмы</Link>
          <Link className="hover:text-mario-green whitespace-nowrap" href="/anime">Аниме</Link>
          <Link className="hover:text-mario-green whitespace-nowrap" href="/latest">Последние</Link>
          <Link className="hover:text-mario-green whitespace-nowrap" href="/top">ТОП</Link>
        </nav>

        <form action="/search" className="ml-auto flex w-full md:w-[330px] border border-mario-line bg-[#f8f8f8] h-9 items-center px-3">
          <input name="q" placeholder="Поиск по сайту..." className="bg-transparent flex-1 outline-none text-sm" />
          <Search size={18} className="text-mario-green" />
        </form>
        <button className="hidden md:block text-yellow-400" aria-label="theme"><Sun size={28} /></button>
      </div>
    </header>
  );
}
