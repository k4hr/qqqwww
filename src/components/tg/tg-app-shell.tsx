import Link from "next/link";
import { TelegramProvider } from "@/components/tg/telegram-provider";
import { TgBottomNav } from "@/components/tg/tg-bottom-nav";

export function TgAppShell({ children }: { children: React.ReactNode }) {
  return (
    <TelegramProvider>
      <div className="min-h-screen bg-[#050507] pb-20 text-white">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070b]/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
<<<<<<< HEAD
            <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e50914] text-white shadow-[0_0_28px_rgba(229,9,20,.45)]">R</span>
              <span>REDFILM</span>
            </Link>
            <Link href="/search" className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-[#d7d7dd]">Поиск</Link>
=======
            <Link href="/tg" className="flex items-center gap-2 font-black tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#e50914] text-white shadow-[0_0_28px_rgba(229,9,20,.45)]">R</span>
              <span>REDFILM</span>
            </Link>
            <Link href="/tg/search" className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-[#d7d7dd]">Поиск</Link>
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-4">{children}</main>
        <TgBottomNav />
      </div>
    </TelegramProvider>
  );
}
