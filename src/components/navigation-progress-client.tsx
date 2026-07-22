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
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const navigationIdRef = useRef(0);

  function clearTimers() {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (failSafeTimerRef.current !== null) window.clearTimeout(failSafeTimerRef.current);
    hideTimerRef.current = null;
    intervalRef.current = null;
    failSafeTimerRef.current = null;
  }

  function start(target?: string) {
    clearTimers();
    const navigationId = ++navigationIdRef.current;
    pendingRef.current = true;
    setFailed(false);
    setTargetHref(target ?? null);
    setVisible(true);
    setProgress(12);
    window.setTimeout(() => setProgress((value) => Math.max(value, 34)), 80);
    intervalRef.current = window.setInterval(() => {
      setProgress((value) => value >= 90 ? value : Math.min(90, value + Math.max(1, (90 - value) * 0.08)));
    }, 180);
    failSafeTimerRef.current = window.setTimeout(() => {
      if (navigationId !== navigationIdRef.current || !pendingRef.current) return;
      pendingRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      setProgress(94);
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
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 180);
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
    complete();
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className={`${failed ? "pointer-events-auto" : "pointer-events-none"} fixed inset-x-0 top-0 z-[160]`}>
      <div className="mx-auto mt-3 flex w-[min(calc(100vw_-_24px),520px)] items-center gap-3 rounded-2xl border border-[#e50914]/30 bg-[#07070b]/92 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,.55),0_0_42px_rgba(229,9,20,.18)] backdrop-blur-xl">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e50914]/15 text-sm font-black text-[#e50914]">R</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[.14em] text-white">
            <span>REDFILM</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#e50914] shadow-[0_0_18px_rgba(229,9,20,.8)] transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
          </div>
          {failed ? <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#ffb0b4]"><span>Переход занял слишком много времени.</span><span className="flex gap-2">{targetHref ? <button type="button" onClick={() => window.location.assign(targetHref)} className="font-black text-white underline">Повторить</button> : null}<button type="button" onClick={() => { setVisible(false); setFailed(false); setProgress(0); }} className="font-black text-white underline">Закрыть</button></span></div> : null}
        </div>
      </div>
    </div>
  );
}
