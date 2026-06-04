import Link from "next/link";
import { Play, ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-[#050811]">
      <div className="container py-10">
        <div className="vip-panel p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#f7e2a9] via-[#c9a86a] to-[#8a6d3a] text-[#0b1020]">
                <Play size={24} fill="currentColor" />
              </span>
              <div className="text-3xl font-black gold-text">MARIOFILM</div>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-white/70">
              <Link href="/movies" className="vip-soft-panel px-4 py-2 hover:text-white">Фильмы</Link>
              <Link href="/series" className="vip-soft-panel px-4 py-2 hover:text-white">Сериалы</Link>
              <Link href="/top" className="vip-soft-panel px-4 py-2 hover:text-white">ТОП</Link>
              <Link href="/latest" className="vip-soft-panel px-4 py-2 hover:text-white">Новинки</Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6 text-sm text-white/55">
            <p className="max-w-2xl flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-[#5ed18c]" /> MARIOFILM — каталог фильмов, сериалов, мультфильмов и аниме.</p>
            <p>© {new Date().getFullYear()} MARIOFILM</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
