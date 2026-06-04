import Link from "next/link";
import { Play } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#202020] text-white mt-10">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-5 border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3 font-black text-2xl">
            <span className="w-9 h-9 rounded-md bg-[#e50914] text-white flex items-center justify-center">
              <Play size={22} fill="currentColor" />
            </span>
            MARIOFILM
          </Link>
          <p className="text-sm text-white/70 md:ml-5">В случае нарушения авторских прав — обращайтесь на почту правообладателя сайта.</p>
        </div>
        <p className="text-sm text-white/60 pt-6">© MARIOFILM — смотреть фильмы онлайн.</p>
      </div>
    </footer>
  );
}
