"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";
import { trackEvent } from "@/lib/client-analytics";

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

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
    router.push(routeIntent?.href ?? `/search?q=${encodeURIComponent(normalized)}`);
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
        onClick={() => setOpen(true)}
        className="hidden h-11 w-[clamp(190px,22vw,320px)] items-center gap-3 rounded-2xl border border-white/10 bg-white/[.05] px-4 text-left text-sm text-[#a1a1aa] transition hover:border-[#e50914]/60 hover:bg-white/[.07] min-[760px]:flex"
        aria-haspopup="dialog"
      >
        <Search size={18} className="text-[#e50914]" />
        <span className="min-w-0 flex-1 truncate">Поиск по сайту...</span>
        <kbd className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[11px] text-[#71717a]">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-white transition hover:border-[#e50914]/60 min-[760px]:hidden"
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
        <div role="dialog" aria-modal="true" aria-label="Поиск REDFILM" className="fixed inset-0 z-[120] bg-black/78 p-3 backdrop-blur-xl sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div ref={panelRef} onKeyDown={trapFocus} className="search-overlay-panel mx-auto flex max-h-[calc(100svh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#09090d]/95 shadow-[0_34px_110px_rgba(0,0,0,.72),0_0_80px_rgba(229,9,20,.16)] sm:max-h-[calc(100svh-48px)]">
            <div className="border-b border-white/10 p-3 sm:p-5">
              <form onSubmit={submitSearch} action="/search" className="flex min-h-14 items-center gap-3 rounded-2xl border border-[#e50914]/35 bg-black/35 px-4 shadow-[0_0_34px_rgba(229,9,20,.12)]">
                <Search size={22} className="shrink-0 text-[#e50914]" />
                <input
                  ref={inputRef}
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                  placeholder="Название, жанр, страна или ID"
                  className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-white outline-none placeholder:text-[#71717a] sm:text-xl"
                />
                <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.05] text-white" aria-label="Закрыть поиск">
                  <X size={19} />
                </button>
              </form>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {query.trim().length < 2 ? (
                <div>
                  <div className="text-sm font-black uppercase tracking-[.16em] text-[#e50914]">Быстрый старт</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="mf-btn">{item.label}</Link>)}
                  </div>
                  <p className="mt-5 max-w-2xl text-sm leading-6 text-[#a1a1aa]">Введите название фильма, сериала, жанр или ID. Полная страница поиска остаётся доступна по обычной ссылке `/search?q=...`.</p>
                </div>
              ) : loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }, (_, index) => <div key={index} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="skeleton aspect-[2/3] rounded-lg" /><div className="space-y-3 py-2"><div className="skeleton h-4 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>)}
                </div>
              ) : hasResults ? (
                <div className="grid gap-6">
                  {groups.filter((group) => group.results.length > 0).map((group) => (
                    <section key={group.key}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="text-lg font-black text-white">{group.title}</h2>
                        <Link href={group.href} onClick={() => setOpen(false)} className="text-sm font-bold text-[#ff4d55]">Все результаты</Link>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.results.map((movie) => (
                          <Link
                            key={movie.id}
                            href={movie.href}
                            onClick={() => {
                              trackEvent("search_suggestion_click", { movieId: movie.id, query });
                              setOpen(false);
                            }}
                            className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-2.5 transition hover:border-[#e50914]/55 hover:bg-white/[.07]"
                          >
                            <div className="poster-fallback relative aspect-[2/3] overflow-hidden rounded-lg">
                              {movie.posterUrl ? <Image src={movie.posterUrl} alt="" fill sizes="52px" className="object-cover" /> : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-black text-white">{movie.title}</div>
                              {movie.originalTitle ? <div className="truncate text-xs font-semibold text-[#b8b8c2]">{movie.originalTitle}</div> : null}
                              <div className="mt-1 text-sm text-[#8d8d97]">{movie.type === "COLLECTION" ? "REDFILM" : movie.year} · {typeLabel(movie.type)}{movie.season ? ` · ${movie.season} сезон${movie.seasonAvailable ? "" : " пока не подтверждён"}` : ""}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/[.035] p-6 text-center">
                  <h2 className="text-xl font-black text-white">Ничего не найдено</h2>
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
