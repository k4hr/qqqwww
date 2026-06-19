import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VibixUnion } from "@/components/vibix-union";

export const metadata: Metadata = {
  title: "REDFILM — фильмы и сериалы онлайн",
  description: "Каталог фильмов, сериалов, мультфильмов и аниме REDFILM.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="site-shell">
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
        <Script id="vibix-union-script" src="https://v-js-menu.run/public/lib.en.min.js" strategy="afterInteractive" />

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
          publisherId={process.env.VIBIX_PUBLISHER_ID?.trim() || "678353780"}
          adTypes={process.env.NEXT_PUBLIC_VIBIX_AD_TYPES?.trim() || "brand,sticker,pcsticker,banners,flyroll"}
        />
      </body>
    </html>
  );
}
