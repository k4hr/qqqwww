import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VibixUnion } from "@/components/vibix-union";
import { MobileZoomLock } from "@/components/mobile-zoom-lock";
import { TelegramWebAppBridge } from "@/components/telegram-webapp-bridge";
import { YandexMetrika } from "@/components/yandex-metrika";
import { getVibixAdSettings, getVibixAddTypesAttribute } from "@/lib/vibix-ads";
import { siteUrl } from "@/lib/seo-links";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Онлайн кинотеатр со всеми фильмами и сериалами. Постоянное обновление каталога, смотрите все новинки здесь!",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=6", type: "image/x-icon", sizes: "any" },
      { url: "/favicon-32.png?v=6", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png?v=6", type: "image/png", sizes: "16x16" },
      { url: "/favicon-120.png?v=6", type: "image/png", sizes: "120x120" },
      { url: "/favicon.svg?v=6", type: "image/svg+xml", sizes: "120x120" },
    ],
    shortcut: [{ url: "/favicon.ico?v=6", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png?v=6", type: "image/png", sizes: "180x180" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const adSettings = await getVibixAdSettings();
  const vibixAdTypes = getVibixAddTypesAttribute(adSettings);

  return (
    <html lang="ru">
      <body className="site-shell">
        <MobileZoomLock />
        <TelegramWebAppBridge />
        <Script id="telegram-webapp-sdk" src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.ym = window.ym || function(){
                (window.ym.a = window.ym.a || []).push(arguments);
              };
              window.ym.l = window.ym.l || 1 * new Date();
            `,
          }}
        />
        <script id="yandex-metrika-tag" async src="https://mc.yandex.ru/metrika/tag.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var counterId = 110229115;
                var isAdmin = window.location.pathname.indexOf("/admin") === 0;
                if (isAdmin || window.__redfilmYandexMetrikaInitialized110229115) return;

                window.__redfilmYandexMetrikaInitialized110229115 = true;
                window.ym(counterId, "init", {
                  ssr: true,
                  webvisor: true,
                  clickmap: true,
                  ecommerce: "dataLayer",
                  accurateTrackBounce: true,
                  trackLinks: true
                });

                if (window.location.search.indexOf("_ym_status-check=110229115") !== -1) {
                  window.setTimeout(function(){
                    if (typeof window.ym === "function") {
                      window.ym(counterId, "hit", window.location.href);
                    }
                  }, 800);

                  window.setTimeout(function(){
                    var pixel = new Image();
                    pixel.referrerPolicy = "strict-origin-when-cross-origin";
                    pixel.src = "https://mc.yandex.ru/watch/110229115?rn=" + Date.now() + "&page-url=" + encodeURIComponent(window.location.href);
                  }, 1200);
                }
              })();
            `,
          }}
        />
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/110229115" style={{ position: "absolute", left: "-9999px" }} alt="" />
          </div>
        </noscript>
        <YandexMetrika />
        <Header />
        <main className="cinematic-page">{children}</main>
        <Footer />
        <VibixUnion
          enabled={adSettings.enabled}
          publisherId={adSettings.publisherId}
          adTypes={vibixAdTypes}
          scriptUrl={adSettings.scriptUrl}
          flyrollPosition={adSettings.flyrollPosition}
        />
      </body>
    </html>
  );
}
