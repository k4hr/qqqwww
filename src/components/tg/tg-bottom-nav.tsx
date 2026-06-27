"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
<<<<<<< HEAD
  { href: "/", label: "Главная" },
  { href: "/search", label: "Поиск" },
  { href: "/favorites", label: "Избранное" },
  { href: "/history", label: "История" },
=======
  { href: "/tg", label: "Главная" },
  { href: "/tg/search", label: "Поиск" },
  { href: "/tg/favorites", label: "Избранное" },
  { href: "/tg/history", label: "История" },
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
];

export function TgBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#07070b]/95 px-3 py-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`rounded-2xl px-2 py-2 text-center text-xs font-bold ${active ? "bg-[#e50914] text-white" : "text-[#a1a1aa]"}`}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
