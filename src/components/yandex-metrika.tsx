"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const COUNTER_ID = 110229115;

function YandexMetrikaInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  const enabled =
    process.env.NODE_ENV === "production" &&
    !pathname?.startsWith("/admin");

  const currentUrl = useMemo(() => {
    const path = pathname || "/";
    const query = searchParams?.toString();
    return query ? `${path}?${query}` : path;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!enabled) return;

    if (previousUrlRef.current === null) {
      previousUrlRef.current = currentUrl;
      return;
    }

    if (previousUrlRef.current === currentUrl) return;
    previousUrlRef.current = currentUrl;

    if (typeof window.ym === "function") {
      window.ym(COUNTER_ID, "hit", currentUrl);
    }
  }, [currentUrl, enabled]);

  return null;
}

export function YandexMetrika() {
  return (
    <Suspense fallback={null}>
      <YandexMetrikaInner />
    </Suspense>
  );
}
