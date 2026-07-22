"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

const NAVIGATION_START_EVENT = "redfilm:navigation-start";

export function startNavigationProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT));
}

export function navigateWithProgress(router: RouterLike, href: string, mode: "push" | "replace" = "push") {
  startNavigationProgress();
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
  const hideTimerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  function clearTimers() {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (failSafeTimerRef.current !== null) window.clearTimeout(failSafeTimerRef.current);
    hideTimerRef.current = null;
    intervalRef.current = null;
    failSafeTimerRef.current = null;
  }

  function start() {
    clearTimers();
    pendingRef.current = true;
    setVisible(true);
    setProgress(12);
    window.setTimeout(() => setProgress((value) => Math.max(value, 34)), 80);
    intervalRef.current = window.setInterval(() => {
      setProgress((value) => value >= 90 ? value : Math.min(90, value + Math.max(1, (90 - value) * 0.08)));
    }, 180);
    failSafeTimerRef.current = window.setTimeout(() => complete(), 14000);
  }

  function complete() {
    if (!pendingRef.current) return;
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
      start();
    };
    const onPageShow = () => complete();
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, start);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    complete();
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[160]">
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
        </div>
      </div>
    </div>
  );
}
