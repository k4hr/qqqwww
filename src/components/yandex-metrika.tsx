"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
  }
}

const RAW_COUNTER_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "110229115";
const COUNTER_ID = Number(RAW_COUNTER_ID);

function YandexMetrikaInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrlRef = useRef<string | null>(null);

  const enabled =
    process.env.NODE_ENV === "production" &&
    Number.isFinite(COUNTER_ID) &&
    COUNTER_ID > 0 &&
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

  if (!enabled) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {
              if (document.scripts[j].src === r) { return; }
            }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],
            k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

          ym(${COUNTER_ID}, "init", {
            ssr: true,
            webvisor: true,
            clickmap: true,
            ecommerce: "dataLayer",
            accurateTrackBounce: true,
            trackLinks: true
          });
        `}
      </Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${COUNTER_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}

export function YandexMetrika() {
  return (
    <Suspense fallback={null}>
      <YandexMetrikaInner />
    </Suspense>
  );
}
