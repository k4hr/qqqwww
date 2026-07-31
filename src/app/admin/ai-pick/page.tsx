import Link from "next/link";

import { prisma } from "@/lib/prisma";

import { updateAiPickConfig } from "./actions";

export const dynamic = "force-dynamic";

function money(value: number): string {
  return `$${value.toFixed(4)}`;
}

export default async function AiPickAdmin() {
  const config = await prisma.aiMatchConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [daily, weekly, monthly, recent] = await Promise.all([
    prisma.aiMatchUsage.aggregate({
      where: {
        createdAt: {
          gte: dayAgo,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.aiMatchUsage.aggregate({
      where: {
        createdAt: {
          gte: weekAgo,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.aiMatchUsage.aggregate({
      where: {
        createdAt: {
          gte: monthAgo,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.aiMatchUsage.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    }),
  ]);

  const uniqueUsers = await prisma.aiMatchUsage.groupBy({
    by: ["sessionIdHash"],
    where: {
      createdAt: {
        gte: monthAgo,
      },
      sessionIdHash: {
        not: null,
      },
    },
  });

  const dailyTokens =
    (daily._sum.inputTokens ?? 0) +
    (daily._sum.outputTokens ?? 0);

  const monthlyTokens =
    (monthly._sum.inputTokens ?? 0) +
    (monthly._sum.outputTokens ?? 0);

  return (
    <div className="container admin-shell py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#222]">
            Контроль ИИ-подбора
          </h1>

          <p className="mt-1 text-neutral-600">
            Использование OpenAI, стоимость, fallback и лимиты.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-lg bg-[#333] px-4 py-2 font-bold text-white"
        >
          В админку
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="Запросов за 24 часа"
          value={daily._count._all}
        />

        <Stat
          label="Расход за 24 часа"
          value={money(daily._sum.estimatedCostUsd ?? 0)}
        />

        <Stat
          label="Расход за 30 дней"
          value={money(monthly._sum.estimatedCostUsd ?? 0)}
        />

        <Stat
          label="Пользователей за 30 дней"
          value={uniqueUsers.length}
        />

        <Stat
          label="Запросов за 7 дней"
          value={weekly._count._all}
        />

        <Stat
          label="Токенов за 24 часа"
          value={dailyTokens.toLocaleString("ru-RU")}
        />

        <Stat
          label="Токенов за 30 дней"
          value={monthlyTokens.toLocaleString("ru-RU")}
        />

        <Stat
          label="Дневной лимит"
          value={money(config.dailyBudgetUsd)}
        />
      </div>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-bold text-[#222]">
          Настройки
        </h2>

        <form
          action={updateAiPickConfig}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <label className="text-sm font-bold text-[#222]">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
              className="mr-2"
            />

            ИИ-подбор включён
          </label>

          <label className="text-sm text-[#222]">
            Модель

            <input
              name="model"
              defaultValue={config.model}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>

          <label className="text-sm text-[#222]">
            Дневной бюджет, USD

            <input
              name="dailyBudgetUsd"
              type="number"
              min="0"
              step="0.1"
              defaultValue={config.dailyBudgetUsd}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>

          <label className="text-sm text-[#222]">
            Кандидатов в AI

            <input
              name="maxCandidates"
              type="number"
              min="12"
              max="100"
              defaultValue={config.maxCandidates}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>

          <label className="text-sm text-[#222]">
            Рекомендаций в партии

            <input
              name="recommendations"
              type="number"
              min="4"
              max="24"
              defaultValue={config.recommendations}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>

          <button className="rounded-lg bg-[#e50914] px-4 py-2 font-bold text-white md:col-span-2">
            Сохранить настройки
          </button>
        </form>
      </section>

      <section className="admin-panel mt-6 overflow-x-auto p-5">
        <h2 className="text-xl font-bold text-[#222]">
          Последние запросы
        </h2>

        <table className="mt-4 w-full min-w-[900px] text-sm text-[#222]">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-2">Время</th>
              <th>Режим</th>
              <th>Модель</th>
              <th>Токены</th>
              <th>Стоимость</th>
              <th>Время ответа</th>
              <th>Кандидаты</th>
              <th>Результат</th>
              <th>Fallback</th>
            </tr>
          </thead>

          <tbody>
            {recent.map((row) => {
              const tokens =
                (row.inputTokens ?? 0) +
                (row.outputTokens ?? 0);

              return (
                <tr
                  key={row.id}
                  className="border-b border-[#eee]"
                >
                  <td className="py-2">
                    {row.createdAt.toLocaleString("ru-RU")}
                  </td>

                  <td>{row.mode}</td>
                  <td>{row.model ?? "—"}</td>
                  <td>{tokens.toLocaleString("ru-RU")}</td>
                  <td>{money(row.estimatedCostUsd)}</td>

                  <td>
                    {row.durationMs !== null
                      ? `${row.durationMs} мс`
                      : "—"}
                  </td>

                  <td>{row.candidateCount}</td>
                  <td>{row.resultCount}</td>
                  <td>{row.fallbackReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="admin-panel p-5">
      <div className="text-sm text-neutral-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black text-[#e50914]">
        {value}
      </div>
    </div>
  );
}
