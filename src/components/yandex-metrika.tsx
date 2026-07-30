"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

const DEFAULT_COUNTER_ID = 111162427;
const configuredCounterId = Number(
  process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || DEFAULT_COUNTER_ID,
);
const COUNTER_ID = Number.isInteger(configuredCounterId) && configuredCounterId > 0
  ? configuredCounterId
  : DEFAULT_COUNTER_ID;

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

function isMetrikaEnabled(pathname: string | null) {
  return process.env.NODE_ENV === "production" && !pathname?.startsWith("/admin");
}

function YandexMetrikaNavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  const currentUrl = useMemo(() => {
    const path = pathname || "/";
    const query = searchParams?.toString();
    return query ? `${path}?${query}` : path;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isMetrikaEnabled(pathname)) return;

    const previousUrl = previousUrlRef.current;
    previousUrlRef.current = currentUrl;

    // The init call records the initial page view. Only client-side route
    // transitions need an explicit hit so Next.js navigation is not missed.
    if (previousUrl === null || previousUrl === currentUrl) return;

    window.ym?.(COUNTER_ID, "hit", currentUrl, {
      title: document.title,
      referer: `${window.location.origin}${previousUrl}`,
    });
  }, [currentUrl, pathname]);

  return null;
}

export function YandexMetrika() {
  const pathname = usePathname();
  const enabled = isMetrikaEnabled(pathname);

  if (!enabled) return null;

  return (
    <>
      <Script
        id="yandex-metrika-counter"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for(var j=0;j<document.scripts.length;j++){
                if(document.scripts[j].src===r){return;}
              }
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}","ym");

            ym(${COUNTER_ID}, "init", {
              ssr: true,
              webvisor: true,
              clickmap: true,
              trackLinks: true,
              accurateTrackBounce: true
            });
          `,
        }}
      />

      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>

      <Suspense fallback={null}>
        <YandexMetrikaNavigationTracker />
      </Suspense>
    </>
  );
}
