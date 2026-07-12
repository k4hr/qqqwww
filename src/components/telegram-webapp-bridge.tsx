"use client";

import { useEffect } from "react";

type TelegramSafeAreaInset = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { user?: unknown };
  platform?: string;
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  viewportHeight?: number;
  viewportStableHeight?: number;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
};

function px(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.max(0, value)}px` : "0px";
}

function isRealTelegramMiniApp(webApp: TelegramWebApp) {
  const hasSignedInitData = typeof webApp.initData === "string" && webApp.initData.length > 0;
  const hasTelegramUser = Boolean(webApp.initDataUnsafe?.user);
  const hasTelegramLaunchParams = typeof window !== "undefined" && window.location.hash.includes("tgWebAppData=");

  return hasSignedInitData || hasTelegramUser || hasTelegramLaunchParams;
}

function setTelegramCssVariables(webApp: TelegramWebApp) {
  const root = document.documentElement;
  const safeArea = webApp.safeAreaInset || {};
  const contentSafeArea = webApp.contentSafeAreaInset || {};

  root.style.setProperty("--tg-safe-top", px(safeArea.top));
  root.style.setProperty("--tg-safe-bottom", px(safeArea.bottom));
  root.style.setProperty("--tg-content-safe-top", px(contentSafeArea.top));
  root.style.setProperty("--tg-content-safe-bottom", px(contentSafeArea.bottom));
  root.style.setProperty("--tg-viewport-height", px(webApp.viewportHeight));
  root.style.setProperty("--tg-viewport-stable-height", px(webApp.viewportStableHeight));
}

function initTelegramWebApp(webApp: TelegramWebApp) {
  document.documentElement.classList.add("is-telegram-webapp");
  setTelegramCssVariables(webApp);

  try { webApp.ready?.(); } catch {}
  try { webApp.expand?.(); } catch {}
  try { webApp.requestFullscreen?.(); } catch {}
  try { webApp.disableVerticalSwipes?.(); } catch {}
  try { webApp.setHeaderColor?.("#09090b"); } catch {}
  try { webApp.setBackgroundColor?.("#09090b"); } catch {}
  try { webApp.setBottomBarColor?.("#09090b"); } catch {}
}

export function TelegramWebAppBridge() {
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let webApp: TelegramWebApp | undefined;
    let removeTelegramEventListeners: (() => void) | undefined;

    const run = () => {
      if (cancelled) return;
      const telegramWindow = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
      webApp = telegramWindow.Telegram?.WebApp;

      if (!webApp) {
        const isTelegramLaunch = window.location.hash.includes("tgWebAppData=") || window.location.search.includes("tgWebAppData=");
        if (!isTelegramLaunch) return;

        if (!document.getElementById("telegram-webapp-sdk")) {
          const script = document.createElement("script");
          script.id = "telegram-webapp-sdk";
          script.src = "https://telegram.org/js/telegram-web-app.js";
          script.async = true;
          script.onload = run;
          document.head.appendChild(script);
        }

        attempts += 1;
        if (attempts <= 30) timer = setTimeout(run, 150);
        return;
      }

      if (!isRealTelegramMiniApp(webApp)) return;

      initTelegramWebApp(webApp);
      const updateViewport = () => setTelegramCssVariables(webApp as TelegramWebApp);
      try { webApp.onEvent?.("viewportChanged", updateViewport); } catch {}
      try { webApp.onEvent?.("safeAreaChanged", updateViewport); } catch {}
      try { webApp.onEvent?.("contentSafeAreaChanged", updateViewport); } catch {}

      removeTelegramEventListeners = () => {
        try { webApp?.offEvent?.("viewportChanged", updateViewport); } catch {}
        try { webApp?.offEvent?.("safeAreaChanged", updateViewport); } catch {}
        try { webApp?.offEvent?.("contentSafeAreaChanged", updateViewport); } catch {}
      };
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      removeTelegramEventListeners?.();
    };
  }, []);

  return null;
}
