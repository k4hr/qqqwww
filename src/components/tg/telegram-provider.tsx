"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getTelegramInitData, getTelegramWebApp } from "@/lib/telegram/webapp-client";

type TelegramSessionUser = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
};

type TelegramContextValue = {
  initData: string;
  user: TelegramSessionUser | null;
  loading: boolean;
  guest: boolean;
};

const TelegramContext = createContext<TelegramContextValue>({ initData: "", user: null, loading: true, guest: true });

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [initData, setInitData] = useState("");
  const [user, setUser] = useState<TelegramSessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    webApp?.ready?.();
    webApp?.expand?.();

    const data = getTelegramInitData();
    setInitData(data);
    if (!data) {
      setLoading(false);
      return;
    }

    fetch("/api/telegram/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: data }),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.ok && payload.user) setUser(payload.user);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ initData, user, loading, guest: !user }), [initData, user, loading]);
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegramSession() {
  return useContext(TelegramContext);
}
