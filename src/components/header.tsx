import Link from "next/link";
import { HeaderCatalogMenuClient } from "@/components/header/header-catalog-menu-client";
import { MobileNavigationClient } from "@/components/header/mobile-navigation-client";
import { SearchOverlayClient } from "@/components/search/search-overlay-client";

const primaryLinks = [
  { href: "/latest", label: "Последнее" },
  { href: "/top-100", label: "ТОП" },
  { href: "/collections", label: "Подборки" },
  { href: "/match", label: "ИИ-подбор" },
];

function HeaderLogo() {
  return (
    <Link href="/" className="brand min-h-11 min-w-0" aria-label="REDFILM">
      <span className="brand-text text-[19px]">
        <span className="text-[#f02b42]">RED</span>FILM
      </span>
    </Link>
  );
}

function DesktopNavigation() {
  return (
    <nav className="hidden min-w-0 items-center gap-0.5 min-[1180px]:flex" aria-label="Основная навигация">
      <HeaderCatalogMenuClient label="Фильмы" base="/films" kind="movies" />
      <HeaderCatalogMenuClient label="Сериалы" base="/series" kind="series" />
      <HeaderCatalogMenuClient label="Мультфильмы" base="/cartoons" kind="cartoons" />
      <HeaderCatalogMenuClient label="Аниме" base="/anime" kind="anime" />
      {primaryLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-h-11 items-center whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium text-[#aeb0b7] transition hover:bg-white/[.045] hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.055] bg-[rgba(7,7,8,.78)] backdrop-blur-[20px]">
      <div className="container relative flex min-h-[64px] items-center gap-3 py-1 lg:gap-4">
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
