import Link from "next/link";
import { Play } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-[#050507] text-white">
      <div className="container relative flex flex-col gap-7 py-10 md:flex-row md:items-center md:justify-between">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e50914]/60 to-transparent" />
        <div>
          <Link href="/" className="inline-flex items-center gap-3 text-xl font-black tracking-[-0.04em]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e50914] text-white shadow-[0_0_28px_rgba(229,9,20,.3)]">
              <Play size={18} fill="currentColor" />
            </span>
            <span><span className="text-[#e50914]">RED</span>FILM</span>
          </Link>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#71717a]">
            Каталог фильмов и сериалов с описаниями, рейтингами и новыми подборками.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-bold text-[#8b8b95] md:justify-end">
          <Link className="hover:text-white" href="/movies">Фильмы</Link>
          <Link className="hover:text-white" href="/series">Сериалы</Link>
          <Link className="hover:text-white" href="/latest">Последнее</Link>
          <Link className="hover:text-white" href="/top">ТОП</Link>
          <Link className="hover:text-white" href="/favorites">Избранное</Link>
          <Link className="hover:text-white" href="/history">Недавно смотрели</Link>
        </div>
        <div className="text-sm text-[#71717a] md:text-right">
          <p>© {new Date().getFullYear()} REDFILM</p>
          <p className="mt-1">По вопросам авторских прав обращайтесь к администрации сайта.</p>
        </div>
      </div>
    </footer>
  );
}
