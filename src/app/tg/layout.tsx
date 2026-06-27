<<<<<<< HEAD
export default function TgRedirectLayout({ children }: { children: React.ReactNode }) {
  return children;
=======
import type { Metadata } from "next";
import Script from "next/script";
import { TgAppShell } from "@/components/tg/tg-app-shell";

export const metadata: Metadata = {
  title: "REDFILM Telegram Mini App",
  robots: { index: false, follow: false },
};

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <TgAppShell>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      {children}
    </TgAppShell>
  );
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
}
