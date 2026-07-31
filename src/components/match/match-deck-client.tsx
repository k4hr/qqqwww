"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw, SkipForward, Star, ThumbsDown, ThumbsUp, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieCard } from "@/components/movie-card";
import { navigateWithProgress } from "@/components/navigation-progress-client";
import { toggleFavorite } from "@/lib/client-watch-history";
import { trackEvent } from "@/lib/client-analytics";
import {
  applyMatchDecision,
  cloneMatchPreferences,
  readMatchHistory,
  readMatchPreferences,
  resetMatchStorage,
  writeMatchState,
} from "@/lib/discovery/match-storage";
import {
  defaultDiscoveryFilters,
  discoveryMoodOptions,
  discoveryPeriodOptions,
  discoveryRuntimeOptions,
  discoveryTypeOptions,
  emptyMatchPreferences,
  type DiscoveryFilters,
  type DiscoveryMovie,
  type MatchHistoryEvent,
  type MatchPreferences,
} from "@/lib/discovery/types";
import { personalizeInitialMatchQueue, restoreMatchQueue } from "@/lib/discovery/match-ranking";
import { watchPath } from "@/lib/seo-links";

type MatchState = "READY" | "LOADING_NEXT" | "EMPTY" | "FINISHED" | "ERROR";
type MatchAction = MatchHistoryEvent["action"];

type MatchUndoEntry = {
  movie: DiscoveryMovie;
  action: MatchAction;
  previousIndex: number;
  previousPreferences: MatchPreferences;
  previousHistory: MatchHistoryEvent[];
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastAt: number;
  axis: "horizontal" | "vertical" | null;
} | null;

const SWIPE_DISTANCE = 92;
const SWIPE_VELOCITY = 0.55;

function getMatchSessionId() {
  const key = "redfilm:ai-pick-session";
  let value = window.localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); window.localStorage.setItem(key, value); }
  return value;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

function seenIds(preferences: MatchPreferences, history: MatchHistoryEvent[]) {
  return Array.from(new Set([
    ...preferences.liked,
    ...preferences.disliked,
    ...preferences.skipped,
    ...history.map((event) => event.movieId),
  ])).slice(-250);
}

export function MatchDeckClient({ movies }: { movies: DiscoveryMovie[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<DiscoveryMovie[]>(movies);
  const [preferences, setPreferences] = useState<MatchPreferences>(() => emptyMatchPreferences());
  const [history, setHistory] = useState<MatchHistoryEvent[]>([]);
  const [filters, setFilters] = useState<DiscoveryFilters>({ ...defaultDiscoveryFilters });
  const [intentText, setIntentText] = useState("");
  const [aiMode, setAiMode] = useState<"AI" | "LOCAL_FALLBACK">("LOCAL_FALLBACK");
  const [matchState, setMatchState] = useState<MatchState>(movies.length ? "READY" : "EMPTY");
  const [hydrated, setHydrated] = useState(false);
  const [undoEntry, setUndoEntry] = useState<MatchUndoEntry | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [actionLocked, setActionLocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const requestIdRef = useRef(0);
  const actionLockRef = useRef(false);
  const decisionTimerRef = useRef<number | null>(null);
  const hasInteractedRef = useRef(false);
  const dragRef = useRef<DragSession>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  const activeMovie = queue[0] ?? null;
  const nextMovies = queue.slice(1, 5);

  useEffect(() => {
    trackEvent("ai_pick_opened");
    const storedPreferences = readMatchPreferences();
    const storedHistory = readMatchHistory();
    const excluded = new Set(seenIds(storedPreferences, storedHistory));
    const initialQueue = personalizeInitialMatchQueue(
      movies,
      storedPreferences,
      excluded,
      defaultDiscoveryFilters,
      hasInteractedRef.current ? queue[0]?.id : null,
    );
    setPreferences(storedPreferences);
    setHistory(storedHistory);
    setQueue(initialQueue);
    setMatchState(initialQueue.length ? "READY" : movies.length ? "LOADING_NEXT" : "EMPTY");
    setHydrated(true);
    if (movies.length && !initialQueue.length) void loadNextBatch({ ...defaultDiscoveryFilters }, storedPreferences, storedHistory, []);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => media.removeEventListener("change", updateMotion);
    // Initial candidates are immutable for the lifetime of the client island.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNextBatch(
    nextFilters = filters,
    currentPreferences = preferences,
    currentHistory = history,
    additionalExcluded = queue.map((movie) => movie.id),
  ) {
    const requestId = ++requestIdRef.current;
    setMatchState("LOADING_NEXT");
    try {
      const response = await fetch("/api/discovery/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          excludeIds: [...seenIds(currentPreferences, currentHistory), ...additionalExcluded].slice(-250),
          likedIds: currentPreferences.liked.slice(-80),
          dislikedIds: currentPreferences.disliked.slice(-120),
          filters: nextFilters,
          preferences: {
            genreWeights: currentPreferences.genreWeights,
            typeWeights: currentPreferences.typeWeights,
            decadeWeights: currentPreferences.decadeWeights,
            countryWeights: currentPreferences.countryWeights,
            runtimeBuckets: currentPreferences.runtimeBuckets,
            runtimePreference: nextFilters.runtime,
          },
          seed: `${Date.now()}-${currentHistory.length}`,
          intentText,
          useAi: intentText.trim().length >= 3,
          sessionId: getMatchSessionId(),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { movies?: DiscoveryMovie[]; mode?: "AI" | "LOCAL_FALLBACK"; explanations?: Record<string, { reason: string; matchedPreferences: string[]; caution: string }> };
      if (requestId !== requestIdRef.current) return;
      const excluded = new Set(seenIds(currentPreferences, currentHistory));
      const nextQueue = (payload.movies ?? []).filter((movie) => !excluded.has(movie.id)).map((movie) => { const info = payload.explanations?.[movie.id]; return info ? { ...movie, explanation: info.reason, matchedPreferences: info.matchedPreferences, caution: info.caution } : movie; });
      setAiMode(payload.mode ?? "LOCAL_FALLBACK");
      trackEvent(payload.mode === "AI" ? "ai_pick_batch_generated" : "ai_pick_fallback_used", { count: nextQueue.length });
      setQueue(nextQueue);
      setUndoEntry(null);
      setMatchState(nextQueue.length ? "READY" : "FINISHED");
    } catch {
      if (requestId === requestIdRef.current) setMatchState("ERROR");
    }
  }

  function resetDrag() {
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
  }

  function cancelDecisionTransition() {
    if (decisionTimerRef.current !== null) window.clearTimeout(decisionTimerRef.current);
    decisionTimerRef.current = null;
    actionLockRef.current = false;
    setActionLocked(false);
  }

  function commitDecision(action: MatchAction) {
    if (!hydrated || !activeMovie || actionLockRef.current || matchState !== "READY") return;
    hasInteractedRef.current = true;
    actionLockRef.current = true;
    setActionLocked(true);
    const movie = activeMovie;
    const previousPreferences = cloneMatchPreferences(preferences);
    const previousHistory = history.map((event) => ({ ...event }));
    const nextPreferences = applyMatchDecision(preferences, movie, action);
    const nextHistory = [...history, { movieId: movie.id, action, createdAt: Date.now() }].slice(-220);
    const remainingQueue = queue.slice(1);
    setPreferences(nextPreferences);
    setHistory(nextHistory);
    setUndoEntry({ movie, action, previousIndex: 0, previousPreferences, previousHistory });
    writeMatchState(nextPreferences, nextHistory);
    trackEvent(action === "LIKE" ? "match_like" : action === "DISLIKE" ? "match_dislike" : "match_skip", { movieId: movie.id });
    setDragging(false);
    setDragX(action === "DISLIKE" ? -Math.max(window.innerWidth, 720) : Math.max(window.innerWidth, 720));

    decisionTimerRef.current = window.setTimeout(() => {
      setQueue(remainingQueue);
      setDragX(0);
      actionLockRef.current = false;
      setActionLocked(false);
      decisionTimerRef.current = null;
      if (remainingQueue.length) setMatchState("READY");
      else void loadNextBatch(filters, nextPreferences, nextHistory, []);
    }, reducedMotion ? 60 : 190);
  }

  function undoLast() {
    if (!undoEntry || actionLockRef.current) return;
    requestIdRef.current += 1;
    const restoredQueue = restoreMatchQueue(undoEntry.movie, queue);
    setQueue(restoredQueue);
    setPreferences(undoEntry.previousPreferences);
    setHistory(undoEntry.previousHistory);
    writeMatchState(undoEntry.previousPreferences, undoEntry.previousHistory);
    setUndoEntry(null);
    setMatchState("READY");
    resetDrag();
    trackEvent("match_undo", { movieId: undoEntry.movie.id });
  }

  function hardReset() {
    cancelDecisionTransition();
    requestIdRef.current += 1;
    const nextPreferences = resetMatchStorage();
    setPreferences(nextPreferences);
    setHistory([]);
    setQueue([]);
    setUndoEntry(null);
    setMatchState("LOADING_NEXT");
    resetDrag();
    trackEvent("match_reset");
    void loadNextBatch(filters, nextPreferences, [], []);
  }

  function updateFilter<Key extends keyof DiscoveryFilters>(key: Key, value: DiscoveryFilters[Key]) {
    cancelDecisionTransition();
    const nextFilters = { ...filters, [key]: value };
    requestIdRef.current += 1;
    setFilters(nextFilters);
    setQueue([]);
    setUndoEntry(null);
    resetDrag();
    void loadNextBatch(nextFilters, preferences, history, []);
  }

  function openActiveMovie() {
    if (!activeMovie) return;
    trackEvent("match_watch", { movieId: activeMovie.id });
    navigateWithProgress(router, watchPath(activeMovie));
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        if (dragRef.current || dragX) {
          event.preventDefault();
          resetDrag();
        }
        return;
      }
      if (!activeMovie || matchState !== "READY") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        commitDecision("DISLIKE");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        commitDecision("LIKE");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        commitDecision("SKIP");
      } else if (event.key === "Enter") {
        event.preventDefault();
        openActiveMovie();
      } else if (event.key === "Backspace" && undoEntry) {
        event.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!hydrated || !activeMovie || matchState !== "READY" || actionLockRef.current || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea, label")) return;
    hasInteractedRef.current = true;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastAt: performance.now(),
      axis: null,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
    }
    drag.lastX = event.clientX;
    drag.lastAt = performance.now();
    if (drag.axis !== "horizontal") return;
    event.preventDefault();
    setDragX(dx);
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const elapsed = Math.max(1, performance.now() - drag.lastAt);
    const velocity = Math.abs(event.clientX - drag.lastX) / elapsed;
    const horizontal = drag.axis === "horizontal";
    dragRef.current = null;
    setDragging(false);
    if (!cancelled && horizontal && (Math.abs(dx) >= SWIPE_DISTANCE || (Math.abs(dx) >= 42 && velocity >= SWIPE_VELOCITY))) {
      commitDecision(dx < 0 ? "DISLIKE" : "LIKE");
      return;
    }
    setDragX(0);
  }

  const cardStyle = useMemo(() => ({
    transform: `translate3d(${dragX}px,0,0) rotate(${reducedMotion ? 0 : Math.max(-7, Math.min(7, dragX / 28))}deg)`,
    transition: dragging ? "none" : reducedMotion ? "opacity 80ms ease" : "transform 190ms cubic-bezier(.2,.8,.2,1)",
    touchAction: "pan-y" as const,
  }), [dragX, dragging, reducedMotion]);

  return (
    <section aria-busy={matchState === "LOADING_NEXT"} className="rf-match-deck grid gap-5">
      <div ref={filtersRef} className="rf-match-toolbar border-b border-white/[.055] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Настройте подбор</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Фильтры применяются на сервере, просмотренные варианты не повторяются.</p>
          </div>
          <button type="button" onClick={undoLast} disabled={!undoEntry || actionLocked} className="mf-btn min-h-11 gap-2 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Отменить последнее решение">
            <Undo2 size={17} /> Отменить
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
          <label className="block text-sm font-semibold text-white" htmlFor="ai-pick-intent">Что хочется посмотреть?</label>
          <p className="mt-1 text-sm text-[#a1a1aa]">Опишите настроение и ограничения — ИИ выберет только из фильмов REDFILM.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea id="ai-pick-intent" value={intentText} onChange={(event) => setIntentText(event.target.value.slice(0, 600))} className="mf-input min-h-24 flex-1 resize-y" placeholder="Например: напряжённый детектив без мистики, не слишком длинный" />
            <button type="button" onClick={() => { trackEvent("ai_pick_intent_submitted", { length: intentText.trim().length }); void loadNextBatch(filters, preferences, history, []); }} disabled={intentText.trim().length < 3 || matchState === "LOADING_NEXT"} className="mf-btn mf-btn-primary self-stretch disabled:opacity-40 sm:self-end">Подобрать с ИИ</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{["Лёгкое на вечер", "Мрачное и напряжённое", "Для просмотра вдвоём", "Семейное", "Что-нибудь необычное"].map((text) => <button key={text} type="button" onClick={() => setIntentText(text)} className="rf-filter">{text}</button>)}</div>
          <div className="mt-3 text-xs text-[#74757d]">Режим: {aiMode === "AI" ? "ИИ-ранжирование" : "локальный подбор"}</div>
        </div>
        <details className="mt-4">
          <summary className="rf-filter w-fit cursor-pointer list-none">Фильтры подбора</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-[#d4d4d8]">Тип
              <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value as DiscoveryFilters["type"])} className="mf-input mt-2 min-h-11 w-full">
                {discoveryTypeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#d4d4d8]">Настроение
              <select value={filters.mood} onChange={(event) => updateFilter("mood", event.target.value as DiscoveryFilters["mood"])} className="mf-input mt-2 min-h-11 w-full">
                {discoveryMoodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#d4d4d8]">Длительность
              <select value={filters.runtime} onChange={(event) => updateFilter("runtime", event.target.value as DiscoveryFilters["runtime"])} className="mf-input mt-2 min-h-11 w-full">
                {discoveryRuntimeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#d4d4d8]">Период
              <select value={filters.period} onChange={(event) => updateFilter("period", event.target.value as DiscoveryFilters["period"])} className="mf-input mt-2 min-h-11 w-full">
                {discoveryPeriodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </details>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rf-match-card min-h-[500px] overflow-hidden rounded-[18px] bg-[#090a0c]" aria-live="polite">
          {activeMovie && matchState !== "ERROR" ? (
            <div
              className="relative min-h-[500px] select-none overflow-hidden"
              style={cardStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => finishPointer(event)}
              onPointerCancel={(event) => finishPointer(event, true)}
              aria-label={`${activeMovie.titleRu}. Свайп влево — не сейчас, вправо — нравится.`}
            >
              <Image src={activeMovie.backdropUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 760px" className="object-cover opacity-45" priority />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,7,.98),rgba(5,5,7,.76)_58%,rgba(5,5,7,.48))]" />
              <div className="relative z-10 grid min-h-[500px] gap-6 p-5 sm:p-7 md:grid-cols-[185px_minmax(0,1fr)] md:items-center lg:p-8">
                <div className="poster-fallback relative mx-auto aspect-[2/3] w-full max-w-[185px] overflow-hidden rounded-[14px] shadow-[0_22px_60px_rgba(0,0,0,.52)]">
                  {activeMovie.posterUrl ? <Image src={activeMovie.posterUrl} alt={activeMovie.titleRu} fill sizes="185px" className="object-cover" /> : null}
                </div>
                <div>
                  <div className="rf-section-eyebrow mb-3 inline-flex items-center gap-2"><Star size={13} /> ИИ-подбор</div>
                  <h2 className="text-[clamp(1.9rem,4.6vw,2.8rem)] font-semibold leading-[1.02] tracking-[-.045em] text-white">{activeMovie.titleRu}</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#b7b8bf]">
                    <span className="mf-badge">{activeMovie.quality || "HD"}</span>
                    <span>{activeMovie.year}</span>
                    {activeMovie.duration ? <span>{activeMovie.duration} мин.</span> : null}
                    <span><b className="rating-kp">КП</b> {activeMovie.kpRating?.toFixed(1) ?? "—"}</span>
                    <span><b className="rating-imdb">IMDb</b> {activeMovie.imdbRating?.toFixed(1) ?? "—"}</span>
                  </div>
                  {activeMovie.explanation ? <div className="mt-4 rounded-xl border border-[#e31b32]/25 bg-[#e31b32]/[.07] p-4"><div className="text-xs font-black uppercase tracking-[.14em] text-[#ff596b]">Почему подходит вам</div><p className="mt-2 text-sm leading-6 text-white">{activeMovie.explanation}</p>{activeMovie.matchedPreferences?.length ? <div className="mt-2 text-xs text-[#b8b8bf]">Совпало: {activeMovie.matchedPreferences.join(" · ")}</div> : null}{activeMovie.caution ? <p className="mt-2 text-xs text-[#8f9098]">Учтите: {activeMovie.caution}</p> : null}</div> : null}
                  <p className="mt-3 line-clamp-3 max-w-2xl text-base leading-7 text-[#d4d4d8]">{activeMovie.description}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button type="button" onClick={() => commitDecision("DISLIKE")} disabled={!hydrated || actionLocked || matchState !== "READY"} className="mf-btn min-h-11 gap-2 disabled:cursor-wait disabled:opacity-55" aria-label="Не нравится, показать следующий"><ThumbsDown size={17} /> Не сейчас</button>
                    <button type="button" onClick={() => commitDecision("LIKE")} disabled={!hydrated || actionLocked || matchState !== "READY"} className="mf-btn min-h-11 gap-2 disabled:cursor-wait disabled:opacity-55" aria-label="Нравится"><ThumbsUp size={17} /> Нравится</button>
                    <button type="button" onClick={() => commitDecision("SKIP")} disabled={!hydrated || actionLocked || matchState !== "READY"} className="mf-btn min-h-11 gap-2 disabled:cursor-wait disabled:opacity-55" aria-label="Нейтрально, следующий фильм"><SkipForward size={17} /> Следующий</button>
                    <button type="button" onClick={() => {
                      toggleFavorite({ id: activeMovie.id, slug: activeMovie.slug, title: activeMovie.titleRu, year: activeMovie.year, posterUrl: activeMovie.posterUrl, type: activeMovie.type, kpRating: activeMovie.kpRating, imdbRating: activeMovie.imdbRating });
                      trackEvent("match_favorite", { movieId: activeMovie.id });
                    }} className="mf-btn min-h-11">В избранное</button>
                    <button type="button" onClick={openActiveMovie} className="mf-btn mf-btn-primary min-h-11">Смотреть</button>
                  </div>
                  <p className="mt-5 text-xs leading-5 text-[#8b8b95]">Клавиши: ← не сейчас, → нравится, ↓ следующий, Enter смотреть, Backspace отменить.</p>
                </div>
              </div>
            </div>
          ) : null}

          {!activeMovie && matchState === "LOADING_NEXT" ? <StatePanel icon={<LoaderCircle className="animate-spin" />} title="Собираем следующую партию" text="Учитываем ваши решения, фильтры и разнообразие каталога." /> : null}
          {!activeMovie && matchState === "EMPTY" ? <StatePanel title="Пока нет подходящих вариантов" text="Измените фильтры или попробуйте повторить загрузку." actions={<><button type="button" onClick={() => void loadNextBatch(filters, preferences, history, [])} className="mf-btn mf-btn-primary">Повторить</button><Link href="/films" className="mf-btn">Перейти в каталог</Link></>} /> : null}
          {matchState === "ERROR" ? <StatePanel title="Не удалось загрузить подбор" text="Каталог продолжает работать. Можно повторить запрос без сброса решений." actions={<><button type="button" onClick={() => void loadNextBatch(filters, preferences, history, [])} className="mf-btn mf-btn-primary">Повторить</button><Link href="/films" className="mf-btn">Каталог</Link></>} /> : null}
          {!activeMovie && matchState === "FINISHED" ? <StatePanel title="Вы просмотрели все подходящие варианты" text="Можно начать заново, изменить фильтры или перейти в каталог." actions={<><button type="button" onClick={hardReset} className="mf-btn mf-btn-primary">Сбросить предпочтения</button><button type="button" onClick={() => filtersRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" })} className="mf-btn">Изменить фильтры</button><Link href="/films" className="mf-btn">Перейти в каталог</Link></>} /> : null}
        </div>

        <aside className="rf-match-queue grid content-start gap-4">
          <div className="border-b border-white/[.07] pb-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold text-white">Очередь</h2><p className="mt-1 text-sm text-[#a1a1aa]">Осталось: {queue.length}</p></div>
              <button type="button" onClick={hardReset} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white" aria-label="Сбросить ИИ-подбор"><RotateCcw size={17} /></button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#a1a1aa]">Лайки мягко усиливают жанры и типы, дизлайки снижают их вес без жёсткой блокировки.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {nextMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        </aside>
      </div>
      {!hydrated ? <span className="sr-only">Загрузка сохранённых предпочтений</span> : null}
    </section>
  );
}

function StatePanel({ icon, title, text, actions }: { icon?: React.ReactNode; title: string; text: string; actions?: React.ReactNode }) {
  return (
    <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
      <div className="max-w-xl">
        {icon ? <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[.05] text-[#e31b32]">{icon}</div> : null}
        <h2 className="text-3xl font-semibold text-white">{title}</h2>
        <p className="mt-3 leading-7 text-[#a1a1aa]">{text}</p>
        {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
