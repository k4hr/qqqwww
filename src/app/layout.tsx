import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VibixUnion } from "@/components/vibix-union";
import { MobileZoomLock } from "@/components/mobile-zoom-lock";
import { TelegramWebAppBridge } from "@/components/telegram-webapp-bridge";
import { getVibixAdSettings, getVibixAddTypesAttribute } from "@/lib/vibix-ads";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://redfilm.win"),
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Онлайн кинотеатр со всеми фильмами и сериалами. Постоянное обновление каталога, смотрите все новинки здесь!",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "120x120" },
      { url: "/favicon-120.png", type: "image/png", sizes: "120x120" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
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

            ym(109634680, "init", {
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
              src="https://mc.yandex.ru/watch/109634680"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>

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
