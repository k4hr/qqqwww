import Link from "next/link";
import { Play } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[#202027] bg-[#09090d] text-white">
      <div className="container flex flex-col gap-5 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 text-xl font-black tracking-[-0.04em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e50914] text-white">
              <Play size={18} fill="currentColor" />
            </span>
            <span><span className="text-[#e50914]">RED</span>FILM</span>
          </Link>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#71717a]">
            Каталог фильмов, сериалов, мультфильмов и аниме с описаниями и рейтингами.
          </p>
        </div>
        <div className="text-sm text-[#71717a] md:text-right">
          <p>© {new Date().getFullYear()} REDFILM</p>
          <p className="mt-1">По вопросам авторских прав обращайтесь к администрации сайта.</p>
        </div>
      </div>
    </footer>
  );
}
