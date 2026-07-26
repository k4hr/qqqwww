"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";
import { trackEvent } from "@/lib/client-analytics";
import { navigateWithProgress } from "@/components/navigation-progress-client";
import { MOBILE_MENU_OPEN_EVENT, SEARCH_OVERLAY_OPEN_EVENT } from "@/components/header/header-overlay-events";

type Suggestion = {
  id: string;
  title: string;
  originalTitle?: string | null;
  year: number;
  type: string;
  posterUrl: string | null;
  href: string;
  season?: number;
  seasonAvailable?: boolean;
};

type SuggestionGroup = {
  key: string;
  title: string;
  href: string;
  results: Suggestion[];
};

function typeLabel(type: string) {
  if (type === "SERIES") return "Сериал";
  if (type === "ANIME") return "Аниме";
  if (type === "CARTOON") return "Мультфильм";
  if (type === "COLLECTION") return "Подборка";
  return "Фильм";
}

const quickLinks = [
  { href: "/films", label: "Фильмы" },
  { href: "/series", label: "Сериалы" },
  { href: "/cartoons", label: "Мультфильмы" },
  { href: "/anime", label: "Аниме" },
  { href: "/match", label: "REDFILM Match" },
];

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function SearchOverlayClient() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SuggestionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openSearch() {
    window.dispatchEvent(new Event(SEARCH_OVERLAY_OPEN_EVENT));
    setOpen(true);
  }

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        openSearch();
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const closeForMobileMenu = () => setOpen(false);
    window.addEventListener(MOBILE_MENU_OPEN_EVENT, closeForMobileMenu);
    return () => window.removeEventListener(MOBILE_MENU_OPEN_EVENT, closeForMobileMenu);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 20);
    trackEvent("search_overlay_open");
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { groups?: SuggestionGroup[]; results?: Suggestion[] };
        if (Array.isArray(data.groups)) setGroups(data.groups);
        else setGroups([{ key: "movies", title: "Найдено", href: `/search?q=${encodeURIComponent(normalized)}`, results: data.results ?? [] }]);
      } catch {
        // Search suggestions are optional. The /search form remains the source of truth.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function submitSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    const routeIntent = resolveSearchRedirectPath(normalized);
    setOpen(false);
    navigateWithProgress(router, routeIntent?.href ?? `/search?q=${encodeURIComponent(normalized)}`);
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const hasResults = groups.some((group) => group.results.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="hidden h-11 w-[clamp(180px,19vw,270px)] items-center gap-3 rounded-[11px] border border-white/[.07] bg-white/[.025] px-3.5 text-left text-[13px] text-[#8f9098] transition hover:border-white/[.14] hover:bg-white/[.045] min-[760px]:flex"
        aria-haspopup="dialog"
      >
        <Search size={17} className="text-[#a0a1a8]" />
        <span className="min-w-0 flex-1 truncate">Поиск по сайту...</span>
        <kbd className="rounded border border-white/[.07] px-1.5 py-0.5 text-[10px] text-[#64656c]">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={openSearch}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-white/[.07] bg-white/[.025] text-white transition hover:border-white/[.14] min-[760px]:hidden"
        aria-label="Открыть поиск"
        aria-haspopup="dialog"
      >
        <Search size={20} />
      </button>
      <noscript>
        <form action="/search" className="hidden min-[760px]:flex h-11 w-[280px] items-center rounded-2xl border border-white/10 bg-white/[.05] px-4">
          <input name="q" placeholder="Поиск по сайту..." className="min-w-0 flex-1 bg-transparent text-white outline-none" />
          <button type="submit" aria-label="Найти"><Search size={18} /></button>
        </form>
      </noscript>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Поиск REDFILM" className="fixed inset-0 z-[120] bg-[#070708]/98 px-3 py-4 backdrop-blur-xl sm:px-8 sm:py-10" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div ref={panelRef} onKeyDown={trapFocus} className="search-overlay-panel mx-auto flex max-h-[calc(100svh-24px)] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-white/[.06] bg-[#090a0c] shadow-[0_28px_90px_rgba(0,0,0,.48)] sm:max-h-[calc(100svh-64px)]">
            <div className="border-b border-white/[.055] p-3 sm:p-4">
              <form onSubmit={submitSearch} action="/search" className="flex min-h-14 items-center gap-3 rounded-[11px] border border-white/[.075] bg-white/[.02] px-4 focus-within:border-white/[.16] focus-within:bg-white/[.032]">
                <Search size={20} className="shrink-0 text-[#8f9098]" />
                <input
                  ref={inputRef}
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder="Название, жанр, страна или ID"
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-white outline-none placeholder:text-[#64656c] sm:text-lg"
                />
                <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#a0a1a8] transition hover:bg-white/[.05] hover:text-white" aria-label="Закрыть поиск">
                  <X size={19} />
                </button>
              </form>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {query.trim().length < 2 ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#e31b32]">Быстрый старт</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rf-filter">{item.label}</Link>)}
                  </div>
                </div>
              ) : loading ? (
                <div className="grid gap-1">
                  {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 border-b border-white/[.06] py-2.5"><div className="skeleton aspect-[2/3] rounded-md" /><div className="space-y-3 py-2"><div className="skeleton h-4 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>)}
                </div>
              ) : hasResults ? (
                <div className="grid gap-6">
                  {groups.filter((group) => group.results.length > 0).map((group) => (
                    <section key={group.key}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold text-white">{group.title}</h2>
                        <Link href={group.href} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-[#a0a1a8] hover:text-white">Все результаты</Link>
                      </div>
                      <div className="divide-y divide-white/[.06]">
                        {group.results.map((movie) => (
                          <Link
                            key={movie.id}
                            href={movie.href}
                            onClick={() => {
                              trackEvent("search_suggestion_click", { movieId: movie.id, query });
                              setOpen(false);
                            }}
                            className="grid min-h-[70px] grid-cols-[44px_minmax(0,1fr)] items-center gap-3 px-1 py-2.5 transition hover:bg-white/[.035]"
                          >
                            <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-lg">
                              {movie.posterUrl ? <Image src={movie.posterUrl} alt="" fill sizes="52px" className="object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{movie.title}</div>
                              {movie.originalTitle ? <div className="truncate text-xs font-normal text-[#74757d]">{movie.originalTitle}</div> : null}
                              <div className="mt-1 text-xs text-[#74757d]">{movie.type === "COLLECTION" ? "REDFILM" : movie.year} · {typeLabel(movie.type)}{movie.season ? ` · ${movie.season} сезон${movie.seasonAvailable ? "" : " пока не подтверждён"}` : ""}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="border-t border-white/[.07] p-6 text-center">
                  <h2 className="text-xl font-semibold text-white">Ничего не найдено</h2>
                  <p className="mt-2 text-[#a1a1aa]">Попробуйте сократить запрос или открыть полный поиск.</p>
                  <button type="button" onClick={() => submitSearch()} className="mf-btn mf-btn-primary mt-4">Открыть /search</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
