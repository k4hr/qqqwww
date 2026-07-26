"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

const NAVIGATION_START_EVENT = "redfilm:navigation-start";

export function startNavigationProgress(target?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: { target } }));
}

export function navigateWithProgress(router: RouterLike, href: string, mode: "push" | "replace" = "push") {
  startNavigationProgress(href);
  router[mode](href);
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isInternalNavigableLink(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const url = new URL(anchor.href);
    return url.origin === window.location.origin && `${url.pathname}${url.search}` !== `${window.location.pathname}${window.location.search}`;
  } catch {
    return false;
  }
}

export function NavigationProgressClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const navigationIdRef = useRef(0);

  function clearTimers() {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (failSafeTimerRef.current !== null) window.clearTimeout(failSafeTimerRef.current);
    if (overlayTimerRef.current !== null) window.clearTimeout(overlayTimerRef.current);
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    hideTimerRef.current = null;
    intervalRef.current = null;
    failSafeTimerRef.current = null;
    overlayTimerRef.current = null;
    advanceTimerRef.current = null;
  }

  function start(target?: string) {
    clearTimers();
    const navigationId = ++navigationIdRef.current;
    pendingRef.current = true;
    setFailed(false);
    setFinishing(false);
    setOverlayVisible(false);
    setTargetHref(target ?? null);
    setVisible(true);
    setProgress(12);
    advanceTimerRef.current = window.setTimeout(() => setProgress((value) => Math.max(value, 34)), 80);
    overlayTimerRef.current = window.setTimeout(() => {
      if (navigationId === navigationIdRef.current && pendingRef.current) setOverlayVisible(true);
    }, 220);
    intervalRef.current = window.setInterval(() => {
      setProgress((value) => value >= 90 ? value : Math.min(90, value + Math.max(1, (90 - value) * 0.08)));
    }, 180);
    failSafeTimerRef.current = window.setTimeout(() => {
      if (navigationId !== navigationIdRef.current || !pendingRef.current) return;
      pendingRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setProgress(96);
      setOverlayVisible(true);
      setFailed(true);
    }, 14000);
    return navigationId;
  }

  function complete(expectedNavigationId?: number) {
    if (expectedNavigationId !== undefined && expectedNavigationId !== navigationIdRef.current) return;
    if (!pendingRef.current && failSafeTimerRef.current === null) return;
    navigationIdRef.current += 1;
    pendingRef.current = false;
    clearTimers();
    setProgress(100);
    setFinishing(true);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setOverlayVisible(false);
      setFinishing(false);
      setProgress(0);
    }, 180);
  }

  function closeProgress() {
    navigationIdRef.current += 1;
    pendingRef.current = false;
    clearTimers();
    setVisible(false);
    setOverlayVisible(false);
    setFinishing(false);
    setFailed(false);
    setProgress(0);
  }

  function retryNavigation() {
    if (!targetHref) return;
    start(targetHref);
    window.location.assign(targetHref);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isModifiedClick(event) || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement) || !isInternalNavigableLink(target)) return;
      start(target.href);
    };
    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
      const form = event.target;
      if ((form.method || "get").toLocaleLowerCase() !== "get") return;
      if (form.target && form.target !== "_self") return;
      try {
        const action = new URL(form.action || window.location.href, window.location.href);
        if (action.origin !== window.location.origin) return;
        const params = new URLSearchParams();
        for (const [key, value] of new FormData(form).entries()) {
          if (typeof value === "string") params.append(key, value);
        }
        action.search = params.toString();
        start(`${action.pathname}${action.search}`);
      } catch {
        // Native form navigation continues without the optional overlay.
      }
    };
    const onPopState = () => {
      // popstate fires after the history URL is already committed, so the
      // pathname effect may have run before start(). Keep one visible frame,
      // then complete this exact navigation instead of waiting for fail-safe.
      const navigationId = start(`${window.location.pathname}${window.location.search}`);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => complete(navigationId)));
    };
    const onNavigationStart = (event: Event) => start((event as CustomEvent<{ target?: string }>).detail?.target);
    const onPageShow = () => complete();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener(NAVIGATION_START_EVENT, onNavigationStart);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(NAVIGATION_START_EVENT, onNavigationStart);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!failed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProgress();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [failed]);

  useEffect(() => {
    complete();
  }, [pathname, searchParams]);

  if (!visible) return null;

  const status = targetHref?.includes("/watch") ? "Открываем фильм"
    : targetHref?.includes("/match") ? "Подбираем кино"
      : targetHref?.includes("/collections") ? "Загружаем подборку"
        : "Загружаем страницу";

  return (
    <div className={`${failed ? "pointer-events-auto" : "pointer-events-none"} fixed inset-0 z-[160]`} role="status" aria-live="polite" aria-label={failed ? "Страница загружается дольше обычного" : status}>
      <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
        <div className="h-full bg-[#e50914] shadow-[0_0_20px_rgba(229,9,20,.9)] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      </div>
      {overlayVisible ? (
        <div className={`absolute inset-0 flex items-center justify-center overflow-hidden bg-[#070708]/97 p-5 backdrop-blur-lg transition-opacity duration-180 motion-reduce:transition-none ${finishing ? "opacity-0" : "opacity-100"}`}>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e31b32]/8 blur-[100px]" />
          <div className="relative w-full max-w-md text-center">
            <div className="text-[clamp(3.2rem,10vw,6.4rem)] font-semibold leading-none tracking-[-.075em] text-white">
              <span className="text-[#e31b32]">RED</span>FILM
            </div>
            <div className="mt-7 flex h-6 items-end justify-center gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map((bar) => (
                <span key={bar} className="w-1.5 rounded-full bg-[#e31b32] motion-safe:animate-pulse" style={{ height: `${10 + bar * 4}px`, animationDelay: `${bar * 110}ms` }} />
              ))}
            </div>
            <p className="mt-5 text-sm font-normal text-[#8e9098]">{failed ? "Страница загружается дольше обычного" : status}</p>
            <div className="mx-auto mt-6 flex max-w-xs items-center justify-between text-xs font-medium text-[#64666d]">
              <span>{failed ? "Проверьте соединение" : "REDFILM"}</span><span>{Math.round(progress)}%</span>
            </div>
            <div className="mx-auto mt-2 h-px max-w-xs overflow-hidden bg-white/[.08]">
              <div className="h-full bg-[#e31b32] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
            </div>
            {failed ? (
              <div className="pointer-events-auto mt-6 flex flex-wrap justify-center gap-3">
                {targetHref ? <button type="button" onClick={retryNavigation} className="mf-btn mf-btn-primary min-h-11">Повторить</button> : null}
                <button type="button" onClick={closeProgress} className="mf-btn min-h-11">Закрыть</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
