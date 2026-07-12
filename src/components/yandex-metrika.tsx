"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    __redfilmYandexMetrikaInitialized110229115?: boolean;
  }
}

const COUNTER_ID = 110229115;
const SCRIPT_ID = "yandex-metrika-tag";

function loadMetrika() {
  if (window.__redfilmYandexMetrikaInitialized110229115) return;
  window.__redfilmYandexMetrikaInitialized110229115 = true;

  window.ym = window.ym || function (...args: unknown[]) {
    const queue = (window.ym as unknown as { a?: unknown[][] }).a || [];
    queue.push(args);
    (window.ym as unknown as { a?: unknown[][] }).a = queue;
  };

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.appendChild(script);
  }

  window.ym(COUNTER_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

function YandexMetrikaInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  const enabled = process.env.NODE_ENV === "production" && !pathname?.startsWith("/admin");
  const currentUrl = useMemo(() => {
    const path = pathname || "/";
    const query = searchParams?.toString();
    return query ? `${path}?${query}` : path;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!enabled) return;

    let idleId: number | undefined;
    const timeoutId = window.setTimeout(loadMetrika, 8000);
    if (window.requestIdleCallback) {
      idleId = window.requestIdleCallback(loadMetrika, { timeout: 7500 });
    }

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (previousUrlRef.current === null) {
      previousUrlRef.current = currentUrl;
      return;
    }
    if (previousUrlRef.current === currentUrl) return;
    previousUrlRef.current = currentUrl;
    window.ym?.(COUNTER_ID, "hit", currentUrl);
  }, [currentUrl, enabled]);

  return null;
}

export function YandexMetrika() {
  return <Suspense fallback={null}><YandexMetrikaInner /></Suspense>;
}
