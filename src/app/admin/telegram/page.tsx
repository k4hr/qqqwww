import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTelegramBotToken, getTelegramBotUsername, getTelegramMiniAppUrl, getTelegramWebhookSecret, getTelegramWebhookUrl, maskTelegramToken } from "@/lib/telegram/config";
import { deleteTelegramWebhookAction, getTelegramWebhookInfoAction, setTelegramWebhookAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ result?: string }> };

function decodeResult(value?: string) {
  if (!value) return null;
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); } catch { return null; }
}

export default async function AdminTelegramPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = decodeResult(params.result);
  const token = getTelegramBotToken();
  const [users, favorites, history, searches, lastSearches] = await Promise.all([
    prisma.telegramUser.count().catch(() => 0),
    prisma.telegramFavorite.count().catch(() => 0),
    prisma.telegramWatchHistory.count().catch(() => 0),
    prisma.telegramSearchLog.count().catch(() => 0),
    prisma.telegramSearchLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);

  return (
    <div className="container admin-shell py-6 text-[#222]">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Telegram Mini App</h1>
<<<<<<< HEAD
          <p className="mt-1 text-neutral-600">Webhook, обычный Mini App URL и статистика Telegram-пользователей REDFILM.</p>
=======
          <p className="mt-1 text-neutral-600">Webhook, Mini App URL и статистика Telegram-пользователей REDFILM.</p>
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
        </div>
        <Link href="/admin" className="font-bold text-[#e50914]">Назад</Link>
      </div>

      {result ? <pre className="mb-5 overflow-auto rounded-xl bg-[#111] p-4 text-xs text-white">{JSON.stringify(result, null, 2)}</pre> : null}

      <section className="admin-panel mb-5 p-5">
        <h2 className="text-xl font-black">Настройки</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Info label="TELEGRAM_BOT_TOKEN" value={token ? `yes (${maskTelegramToken(token)})` : "no"} />
          <Info label="TELEGRAM_BOT_USERNAME" value={getTelegramBotUsername() || "not set"} />
          <Info label="TELEGRAM_MINI_APP_URL" value={getTelegramMiniAppUrl()} />
          <Info label="TELEGRAM_WEBHOOK_SECRET" value={getTelegramWebhookSecret() ? "yes" : "no"} />
          <Info label="Webhook URL" value={getTelegramWebhookUrl()} />
          <Info label="Test player" value="https://redfilm.win/tg-test-player" />
        </div>
<<<<<<< HEAD

        <p className="mt-4 rounded-xl border border-[#e50914]/20 bg-[#fff5f5] p-3 text-sm font-semibold text-[#5f1b1f]">
          Telegram Mini App открывает обычную мобильную версию REDFILM. TelegramWebAppBridge автоматически включает fullscreen, safe-area отступы и отключение вертикальных свайпов, когда сайт открыт внутри Telegram.
        </p>
=======
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
        <div className="mt-5 flex flex-wrap gap-3">
          <form action={setTelegramWebhookAction}><button className="rounded-xl bg-[#e50914] px-5 py-3 font-black text-white">setWebhook</button></form>
          <form action={getTelegramWebhookInfoAction}><button className="rounded-xl bg-[#222] px-5 py-3 font-black text-white">getWebhookInfo</button></form>
          <form action={deleteTelegramWebhookAction}><button className="rounded-xl border border-[#ddd] px-5 py-3 font-black text-[#222]">deleteWebhook</button></form>
        </div>
        <p className="mt-4 text-sm text-neutral-600">
          Ручной вариант: https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url={getTelegramWebhookUrl()}&amp;secret_token=&lt;SECRET&gt;
        </p>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Telegram users" value={users} />
        <Stat title="Favorites" value={favorites} />
        <Stat title="History" value={history} />
        <Stat title="Search logs" value={searches} />
      </div>

      <section className="admin-panel p-5">
        <h2 className="text-xl font-black">Последние поиски</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b text-left text-neutral-500"><tr><th className="py-2">Дата</th><th>Пользователь</th><th>Запрос</th><th>Результатов</th></tr></thead>
            <tbody className="divide-y divide-[#eee]">
              {lastSearches.map((item) => <tr key={item.id}><td className="py-3">{item.createdAt.toLocaleString("ru-RU")}</td><td>{item.user?.username || item.user?.telegramId || "guest"}</td><td className="font-semibold">{item.query}</td><td>{item.resultCount}</td></tr>)}
            </tbody>
          </table>
          {!lastSearches.length ? <p className="mt-3 text-neutral-500">Поисков пока нет.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#eee] bg-white p-3"><div className="text-xs font-bold uppercase text-neutral-500">{label}</div><div className="mt-1 break-all font-semibold">{value}</div></div>;
}

function Stat({ title, value }: { title: string; value: number }) {
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className="mt-2 text-3xl font-bold text-[#e50914]">{value.toLocaleString("ru-RU")}</div></div>;
}
