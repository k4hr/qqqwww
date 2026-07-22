import Link from "next/link";
import { HeaderCatalogMenuClient } from "@/components/header/header-catalog-menu-client";
import { MobileNavigationClient } from "@/components/header/mobile-navigation-client";
import { SearchOverlayClient } from "@/components/search/search-overlay-client";

const primaryLinks = [
  { href: "/latest", label: "Последнее" },
  { href: "/top-100", label: "ТОП" },
  { href: "/collections", label: "Подборки" },
  { href: "/match", label: "REDFILM Match" },
];

function HeaderLogo() {
  return (
    <Link href="/" className="brand min-w-0" aria-label="REDFILM">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#e50914]/45 bg-[#e50914]/15 shadow-[0_0_28px_rgba(229,9,20,.24)]">
        <span className="text-lg font-black text-[#e50914]">R</span>
      </span>
      <span className="brand-text text-[clamp(19px,4vw,24px)]">
        <span className="text-[#e50914]">RED</span>FILM
      </span>
    </Link>
  );
}

function DesktopNavigation() {
  return (
    <nav className="hidden min-w-0 items-center gap-1 min-[980px]:flex" aria-label="Основная навигация">
      <HeaderCatalogMenuClient label="Фильмы" base="/films" kind="movies" />
      <HeaderCatalogMenuClient label="Сериалы" base="/series" kind="series" />
      <HeaderCatalogMenuClient label="Мультфильмы" base="/cartoons" kind="cartoons" />
      <HeaderCatalogMenuClient label="Аниме" base="/anime" kind="anime" />
      {primaryLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full px-3 py-2 text-[13px] font-bold text-[#d4d4d8] transition hover:bg-white/[.07] hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e50914]/25 bg-[rgba(5,5,8,.84)] shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-[18px]">
      <div className="container relative flex min-h-[72px] items-center gap-3 py-2.5 lg:gap-4">
        <HeaderLogo />
        <DesktopNavigation />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SearchOverlayClient />
          <MobileNavigationClient />
        </div>
      </div>
    </header>
  );
}
