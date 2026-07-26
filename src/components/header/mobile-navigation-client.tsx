"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { catalogHref, NAV_YEARS, type CatalogBase } from "@/lib/navigation-data";
import { countriesByKind, genresByKind, type CatalogMenuKind } from "@/components/header/header-menu-data";
import { MOBILE_MENU_OPEN_EVENT, SEARCH_OVERLAY_OPEN_EVENT } from "@/components/header/header-overlay-events";

function MobileAccordion({ label, base, kind, close }: { label: string; base: CatalogBase; kind: CatalogMenuKind; close: () => void }) {
  return (
    <details className="border-b border-white/[.07]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between py-2 text-[15px] font-semibold text-white">
        {label}
        <ChevronDown size={18} />
      </summary>
      <div className="pb-4">
        <Link onClick={close} href={base} className="mobile-menu-link">Все {label.toLowerCase()}</Link>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#e31b32]">По году</div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_YEARS.slice(0, 7).map((item) => (
            <Link onClick={close} key={item.value} href={catalogHref(base, "year", item.value)} className="mf-pill min-h-11 shrink-0">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#e31b32]">По жанрам</div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {genresByKind(kind).map((item) => <Link onClick={close} key={item.value} href={catalogHref(base, "genre", item.value)} className="mobile-menu-link">{item.label}</Link>)}
        </div>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[.12em] text-[#e31b32]">По странам</div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {countriesByKind(kind).map((item) => <Link onClick={close} key={item.value} href={catalogHref(base, "country", item.value)} className="mobile-menu-link">{item.label}</Link>)}
        </div>
      </div>
    </details>
  );
}

export function MobileNavigationClient() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    const closeForSearch = () => setOpen(false);
    window.addEventListener(SEARCH_OVERLAY_OPEN_EVENT, closeForSearch);
    return () => window.removeEventListener(SEARCH_OVERLAY_OPEN_EVENT, closeForSearch);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      buttonRef.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={open}
        aria-controls={id}
        ref={buttonRef}
        onClick={() => setOpen((value) => {
          const nextOpen = !value;
          if (nextOpen) window.dispatchEvent(new Event(MOBILE_MENU_OPEN_EVENT));
          return nextOpen;
        })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-white/[.08] bg-white/[.035] text-white min-[1180px]:hidden"
      >
        {open ? <X /> : <Menu />}
      </button>
      {open ? (
        <div id={id} className="absolute inset-x-0 top-full max-h-[calc(100svh-66px)] overflow-y-auto border-t border-white/[.07] bg-[rgba(7,7,9,.985)] px-4 pb-5 shadow-[0_24px_72px_rgba(0,0,0,.62)] min-[1180px]:hidden">
          <MobileAccordion label="Фильмы" base="/films" kind="movies" close={close} />
          <MobileAccordion label="Сериалы" base="/series" kind="series" close={close} />
          <MobileAccordion label="Мультфильмы" base="/cartoons" kind="cartoons" close={close} />
          <MobileAccordion label="Аниме" base="/anime" kind="anime" close={close} />
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Link onClick={close} className="mobile-menu-link" href="/latest">Последнее</Link>
            <Link onClick={close} className="mobile-menu-link" href="/top-100">ТОП</Link>
            <Link onClick={close} className="mobile-menu-link" href="/match">REDFILM Match</Link>
            <Link onClick={close} className="mobile-menu-link" href="/favorites">Избранное</Link>
            <Link onClick={close} className="mobile-menu-link" href="/history">История</Link>
            <Link onClick={close} className="mobile-menu-link" href="/collections">Подборки</Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
