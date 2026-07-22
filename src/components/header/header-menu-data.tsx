import Link from "next/link";
import { NAV_COUNTRIES, NAV_GENRES, NAV_YEARS, catalogHref, type CatalogBase } from "@/lib/navigation-data";

export type CatalogMenuKind = "movies" | "series" | "cartoons" | "anime";

export function labelByKind(kind: CatalogMenuKind) {
  if (kind === "series") return { plural: "сериалы", menu: "Сериалы", year: "Сериалы", top: "ТОП сериалов" };
  if (kind === "cartoons") return { plural: "мультфильмы", menu: "Мультфильмы", year: "Мультфильмы", top: "ТОП мультфильмов" };
  if (kind === "anime") return { plural: "аниме", menu: "Аниме", year: "Аниме", top: "ТОП аниме" };
  return { plural: "фильмы", menu: "Фильмы", year: "Фильмы", top: "ТОП 100" };
}

export function genresByKind(kind: CatalogMenuKind) {
  if (kind === "series") return NAV_GENRES.filter((item) => ["dramy", "komedii", "detektivy", "kriminal", "trillery", "fantastika", "melodramy", "priklyucheniya"].includes(item.value));
  if (kind === "cartoons") return NAV_GENRES.filter((item) => ["multfilmy", "semeynye", "priklyucheniya", "komedii", "fentezi", "fantastika", "anime", "dramy", "uzhasy"].includes(item.value));
  if (kind === "anime") return NAV_GENRES.filter((item) => ["anime", "fantastika", "fentezi", "priklyucheniya", "dramy", "komedii", "trillery", "uzhasy"].includes(item.value));
  return NAV_GENRES.filter((item) => !["multfilmy", "anime"].includes(item.value)).slice(0, 10);
}

export function countriesByKind(kind: CatalogMenuKind) {
  if (kind === "anime") return NAV_COUNTRIES.filter((item) => ["japan", "korea", "china", "usa", "russia"].includes(item.value));
  if (kind === "cartoons") return NAV_COUNTRIES.filter((item) => ["usa", "japan", "russia", "france", "uk", "china", "korea", "germany"].includes(item.value));
  return NAV_COUNTRIES.filter((item) => kind !== "series" || item.value !== "italy").slice(0, kind === "series" ? 9 : 8);
}

function MenuColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-xs font-black uppercase tracking-[.14em] text-[#e50914]">{title}</div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

export function HeaderMenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="rounded-lg px-2 py-2 text-sm font-semibold text-[#d4d4d8] transition hover:bg-white/[.06] hover:text-white">
      {children}
    </Link>
  );
}

export function MegaMenu({ base, kind }: { base: CatalogBase; kind: CatalogMenuKind }) {
  const labels = labelByKind(kind);
  return (
    <div className="mega-menu fixed left-1/2 top-[72px] z-[70] w-[min(calc(100vw_-_32px),1100px)] -translate-x-1/2 rounded-[18px] border border-white/10 bg-[rgba(10,10,14,.97)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.72)] backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-7">
        <MenuColumn title={labels.menu}>
          <HeaderMenuLink href={base}>Все {labels.plural}</HeaderMenuLink>
          <HeaderMenuLink href={catalogHref(base, "sort", "popular")}>Популярные</HeaderMenuLink>
          <HeaderMenuLink href={catalogHref(base, "sort", "new")}>Новинки</HeaderMenuLink>
          <HeaderMenuLink href={catalogHref(base, "sort", "rating")}>{labels.top}</HeaderMenuLink>
          <HeaderMenuLink href={catalogHref(base, "year", "2026")}>{labels.year} 2026</HeaderMenuLink>
        </MenuColumn>
        <MenuColumn title="По году">{NAV_YEARS.slice(0, kind === "movies" ? 9 : 7).map((item) => <HeaderMenuLink key={item.value} href={catalogHref(base, "year", item.value)}>{item.label}</HeaderMenuLink>)}</MenuColumn>
        <MenuColumn title="По жанрам">{genresByKind(kind).map((item) => <HeaderMenuLink key={item.value} href={catalogHref(base, "genre", item.value)}>{item.label}</HeaderMenuLink>)}</MenuColumn>
        <MenuColumn title="По странам">{countriesByKind(kind).map((item) => <HeaderMenuLink key={item.value} href={catalogHref(base, "country", item.value)}>{item.label}</HeaderMenuLink>)}</MenuColumn>
      </div>
    </div>
  );
}
