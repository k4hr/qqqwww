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

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const adSettings = await getVibixAdSettings();
  const vibixAdTypes = getVibixAddTypesAttribute(adSettings);

  return (
    <html lang="ru">
      <body className="site-shell">
        <MobileZoomLock />
        <TelegramWebAppBridge />
        <Script id="telegram-webapp-sdk" src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <Script id="redfilm-vibix-player-sdk" src="https://graphicslab.io/sdk/v2/rendex-sdk.min.js" strategy="afterInteractive" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(m,e,t,r,i,k,a){
                if (m.__redfilmYandexMetrika110229115) return;
                m.__redfilmYandexMetrika110229115 = true;

                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();

                for (var j = 0; j < document.scripts.length; j++) {
                  if (document.scripts[j].src === r) { return; }
                }

                k=e.createElement(t),a=e.getElementsByTagName(t)[0],
                k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
              })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

              if (!window.location.pathname.startsWith("/admin")) {
                ym(110229115, "init", {
                  ssr: true,
                  webvisor: true,
                  clickmap: true,
                  ecommerce: "dataLayer",
                  accurateTrackBounce: true,
                  trackLinks: true
                });
              }
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
