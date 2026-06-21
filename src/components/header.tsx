"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { NAV_COUNTRIES, NAV_GENRES, NAV_YEARS, catalogHref, type CatalogBase } from "@/lib/navigation-data";
import { SearchAutocomplete } from "@/components/search-autocomplete";

type CatalogMenuKind = "movies" | "series" | "cartoons" | "anime";

function MenuColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-3 text-xs font-black uppercase tracking-[.14em] text-[#e50914]">{title}</div><div className="grid gap-1">{children}</div></div>;
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-lg px-2 py-2 text-sm font-semibold text-[#d4d4d8] transition hover:bg-white/[.06] hover:text-white">{children}</Link>;
}

function labelByKind(kind: CatalogMenuKind) {
  if (kind === "series") return { singular: "сериал", plural: "сериалы", menu: "Сериалы", year: "Сериалы", top: "ТОП сериалов" };
  if (kind === "cartoons") return { singular: "мультфильм", plural: "мультфильмы", menu: "Мультфильмы", year: "Мультфильмы", top: "ТОП мультфильмов" };
  if (kind === "anime") return { singular: "аниме", plural: "аниме", menu: "Аниме", year: "Аниме", top: "ТОП аниме" };
  return { singular: "фильм", plural: "фильмы", menu: "Фильмы", year: "Фильмы", top: "ТОП 100" };
}

function genresByKind(kind: CatalogMenuKind) {
  if (kind === "series") return NAV_GENRES.filter((item) => ["dramy", "komedii", "detektivy", "kriminal", "trillery", "fantastika", "melodramy", "priklyucheniya"].includes(item.value));
  if (kind === "cartoons") return NAV_GENRES.filter((item) => ["multfilmy", "semeynye", "priklyucheniya", "komedii", "fentezi", "fantastika", "anime", "dramy", "uzhasy"].includes(item.value));
  if (kind === "anime") return NAV_GENRES.filter((item) => ["anime", "fantastika", "fentezi", "priklyucheniya", "dramy", "komedii", "trillery", "uzhasy"].includes(item.value));
  return NAV_GENRES.filter((item) => !["multfilmy", "anime"].includes(item.value)).slice(0, 10);
}

function countriesByKind(kind: CatalogMenuKind) {
  if (kind === "anime") return NAV_COUNTRIES.filter((item) => ["japan", "korea", "china", "usa", "russia"].includes(item.value));
  if (kind === "cartoons") return NAV_COUNTRIES.filter((item) => ["usa", "japan", "russia", "france", "uk", "china", "korea", "germany"].includes(item.value));
  return NAV_COUNTRIES.filter((item) => kind !== "series" || item.value !== "italy").slice(0, kind === "series" ? 9 : 8);
}

function MegaMenu({ base, kind }: { base: CatalogBase; kind: CatalogMenuKind }) {
  const labels = labelByKind(kind);
  const genres = genresByKind(kind);
  const countries = countriesByKind(kind);
  return <div className="mega-menu fixed left-1/2 top-[72px] z-[70] w-[min(calc(100vw_-_32px),1100px)] -translate-x-1/2 rounded-[18px] border border-white/10 bg-[rgba(10,10,14,.97)] p-6 shadow-[0_28px_90px_rgba(0,0,0,.72)] backdrop-blur-xl">
    <div className="grid grid-cols-4 gap-7">
      <MenuColumn title={labels.menu}>
        <MenuLink href={base}>Все {labels.plural}</MenuLink>
        <MenuLink href={catalogHref(base, "sort", "popular")}>Популярные</MenuLink>
        <MenuLink href={catalogHref(base, "sort", "new")}>Новинки</MenuLink>
        <MenuLink href={catalogHref(base, "sort", "rating")}>{labels.top}</MenuLink>
        <MenuLink href={catalogHref(base, "year", "2026")}>{labels.year} 2026</MenuLink>
        {kind === "cartoons" ? <MenuLink href="/anime">Аниме</MenuLink> : null}
      </MenuColumn>
      <MenuColumn title="По году">{NAV_YEARS.slice(0, kind === "movies" ? 9 : 7).map((item) => <MenuLink key={item.value} href={catalogHref(base, "year", item.value)}>{item.label}</MenuLink>)}</MenuColumn>
      <MenuColumn title="По жанрам">{genres.map((item) => <MenuLink key={item.value} href={catalogHref(base, "genre", item.value)}>{item.label}</MenuLink>)}</MenuColumn>
      <MenuColumn title="По странам">{countries.map((item) => <MenuLink key={item.value} href={catalogHref(base, "country", item.value)}>{item.label}</MenuLink>)}</MenuColumn>
    </div>
  </div>;
}

function DesktopCatalogMenu({ label, base, kind, open, setOpen }: { label: string; base: CatalogBase; kind: CatalogMenuKind; open: boolean; setOpen: (value: boolean) => void }) {
  const id = `${kind}-mega-menu`;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const openMenu = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => () => cancelClose(), []);

  return <div className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose} onFocus={openMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" aria-expanded={open} aria-controls={id} aria-haspopup="true" onClick={() => setOpen(!open)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold text-[#d4d4d8] hover:bg-white/[.07] hover:text-white">{label}<ChevronDown size={14} className={open ? "rotate-180" : ""} /></button>
    {open ? <span aria-hidden className="absolute inset-x-0 top-full h-[18px]" /> : null}
    <div id={id} className={open ? "block" : "hidden"}><MegaMenu base={base} kind={kind} /></div>
  </div>;
}

function MobileAccordion({ label, base, kind, close }: { label: string; base: CatalogBase; kind: CatalogMenuKind; close: () => void }) {
  const genres = genresByKind(kind);
  return <details className="border-b border-white/10"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between py-2 text-base font-black text-white">{label}<ChevronDown size={18} /></summary><div className="pb-4"><Link onClick={close} href={base} className="mobile-menu-link">Все {label.toLowerCase()}</Link><div className="mt-3 text-xs font-black uppercase tracking-wider text-[#e50914]">По году</div><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{NAV_YEARS.slice(0, 7).map((item) => <Link onClick={close} key={item.value} href={catalogHref(base, "year", item.value)} className="mf-pill min-h-11 shrink-0">{item.label}</Link>)}</div><div className="mt-3 text-xs font-black uppercase tracking-wider text-[#e50914]">По жанрам</div><div className="mt-2 grid grid-cols-2 gap-1">{genres.map((item) => <Link onClick={close} key={item.value} href={catalogHref(base, "genre", item.value)} className="mobile-menu-link">{item.label}</Link>)}</div><div className="mt-3 text-xs font-black uppercase tracking-wider text-[#e50914]">По странам</div><div className="mt-2 grid grid-cols-2 gap-1">{countriesByKind(kind).map((item) => <Link onClick={close} key={item.value} href={catalogHref(base, "country", item.value)} className="mobile-menu-link">{item.label}</Link>)}</div></div></details>;
}

export function Header() {
  const [openMenu, setOpenMenu] = useState<CatalogMenuKind | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpenMenu(null); setMobileOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const closeMobile = () => setMobileOpen(false);
  return <header className="sticky top-0 z-50 border-b border-[#e50914]/25 bg-[rgba(5,5,8,.82)] shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-[18px]">
    <div className="container relative flex min-h-[72px] items-center gap-4 py-2.5">
      <Link href="/" className="shrink-0 text-[clamp(22px,5vw,28px)] font-black tracking-[-.06em] text-white" aria-label="REDFILM"><span className="text-[#e50914]">RED</span>FILM</Link>
      <nav className="hidden items-center gap-1 min-[900px]:flex" aria-label="Основная навигация">
        <DesktopCatalogMenu label="Фильмы" base="/films" kind="movies" open={openMenu === "movies"} setOpen={(value) => setOpenMenu(value ? "movies" : null)} />
        <DesktopCatalogMenu label="Сериалы" base="/series" kind="series" open={openMenu === "series"} setOpen={(value) => setOpenMenu(value ? "series" : null)} />
        <DesktopCatalogMenu label="Мультфильмы" base="/cartoons" kind="cartoons" open={openMenu === "cartoons"} setOpen={(value) => setOpenMenu(value ? "cartoons" : null)} />
        <MenuLink href="/latest">Новинки</MenuLink><MenuLink href="/popular">Популярное</MenuLink><MenuLink href="/collections">Подборки</MenuLink><span className="hidden min-[1180px]:contents"><MenuLink href="/favorites">Избранное</MenuLink></span>
      </nav>
      <SearchAutocomplete />
      <button type="button" aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(!mobileOpen)} className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-white min-[900px]:hidden">{mobileOpen ? <X /> : <Menu />}</button>
    </div>
    <div className="container pb-2.5 min-[900px]:hidden"><SearchAutocomplete mobile /></div>
    {mobileOpen ? <div id="mobile-navigation" className="container max-h-[calc(100svh-116px)] overflow-y-auto border-t border-white/10 bg-[rgba(5,5,8,.98)] pb-5 min-[900px]:hidden"><MobileAccordion label="Фильмы" base="/films" kind="movies" close={closeMobile} /><MobileAccordion label="Сериалы" base="/series" kind="series" close={closeMobile} /><MobileAccordion label="Мультфильмы" base="/cartoons" kind="cartoons" close={closeMobile} /><div className="grid grid-cols-2 gap-2 pt-4"><Link onClick={closeMobile} className="mobile-menu-link" href="/anime">Аниме</Link><Link onClick={closeMobile} className="mobile-menu-link" href="/latest">Новинки</Link><Link onClick={closeMobile} className="mobile-menu-link" href="/popular">Популярное</Link><Link onClick={closeMobile} className="mobile-menu-link" href="/favorites">Избранное</Link><Link onClick={closeMobile} className="mobile-menu-link" href="/history">Недавно смотрели</Link><Link onClick={closeMobile} className="mobile-menu-link col-span-2" href="/collections">Подборки</Link></div></div> : null}
  </header>;
}
