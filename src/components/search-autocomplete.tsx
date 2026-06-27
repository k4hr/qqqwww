"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { resolveSearchRedirectPath } from "@/lib/search-route-intents";

type Suggestion = { id: string; title: string; year: number; type: string; posterUrl: string | null; href: string };

export function SearchAutocomplete({ mobile = false }: { mobile?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { results?: Suggestion[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // Suggestions are optional and must never block search.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    setOpen(false);
    inputRef.current?.blur();
    const routeIntent = resolveSearchRedirectPath(normalized);
    router.push(routeIntent?.href ?? `/search?q=${encodeURIComponent(normalized)}`);
  }

  const shellClass = mobile
    ? "relative w-full"
    : "relative ml-auto w-[clamp(190px,22vw,310px)] shrink-0 max-[899px]:hidden";

  return <div ref={rootRef} className={shellClass}>
    <form onSubmit={submitSearch} action="/search" className="flex h-11 w-full items-center rounded-2xl border border-white/10 bg-white/[.05] px-4 transition focus-within:border-[#e50914]/80">
      <input ref={inputRef} name="q" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => results.length && setOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} autoComplete="off" enterKeyHint="search" aria-label="Поиск по сайту" placeholder="Поиск по сайту..." className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-[#71717a] min-[900px]:text-sm" />
      <button type="submit" aria-label="Найти" className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#e50914] transition hover:bg-white/[.06]"><Search size={18} /></button>
    </form>
    {open && (loading || results.length > 0) ? <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[90] max-h-[min(420px,60vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0b0f]/[.98] p-2 shadow-[0_24px_70px_rgba(0,0,0,.75)] backdrop-blur-xl">
      {loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="grid min-h-14 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 p-2"><div className="skeleton h-12 rounded-md" /><div className="space-y-2"><div className="skeleton h-3 w-4/5 rounded" /><div className="skeleton h-3 w-2/5 rounded" /></div></div>) : results.map((movie) => <Link key={movie.id} href={movie.href} onClick={() => setOpen(false)} className="grid min-h-14 grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-xl p-2 transition hover:bg-white/[.07]">
        <div className="relative h-12 overflow-hidden rounded-md bg-[#18181f]">{movie.posterUrl ? <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
        <div className="min-w-0"><div className="truncate text-sm font-bold text-white">{movie.title}</div><div className="mt-1 text-xs text-[#8d8d97]">{movie.year} · {movie.type === "SERIES" ? "Сериал" : movie.type === "ANIME" ? "Аниме" : movie.type === "CARTOON" ? "Мультфильм" : "Фильм"}</div></div>
      </Link>)}
    </div> : null}
  </div>;
}
