import { prisma } from "@/lib/prisma";
import { AdminStat, CollaborationAdminShell } from "@/app/admin/collaboration/_components";
import { formatMoney, getPartnerDailyRows, getPartnerEventSummary } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function CollaborationAdminPage() {
  const [summary, rows, latestPartners] = await Promise.all([
    getPartnerEventSummary(),
    getPartnerDailyRows(undefined, 14),
    prisma.partner.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <CollaborationAdminShell title="Сотрудничество" description="Партнёрская система REDFILM: блогеры, авторские подборки, ссылки, атрибуция, доход и выплаты.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat title="Активных партнёров" value={summary.activePartners} />
        <AdminStat title="Переходов сегодня" value={summary.clicksToday} />
        <AdminStat title="Переходов за 7 дней" value={summary.clicks7} />
        <AdminStat title="Переходов за 30 дней" value={summary.clicks30} />
        <AdminStat title="Уникальных посетителей" value={summary.uniqueVisitors} />
        <AdminStat title="Повторных посетителей" value={summary.returnVisits} />
        <AdminStat title="Открытий фильмов" value={summary.movieOpens} />
        <AdminStat title="Стартов плеера" value={summary.playerStarts} />
        <AdminStat title="Расчётный доход" value={formatMoney(summary.estimatedGrossRevenue)} />
        <AdminStat title="Подтверждённый доход" value={formatMoney(summary.confirmedGrossRevenue)} />
        <AdminStat title="К выплате" value={formatMoney(summary.payable)} />
        <AdminStat title="Уже выплачено" value={formatMoney(summary.paid)} />
      </div>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">Динамика по дням</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-[#222]">
            <thead className="border-b border-[#e5e5e5] text-left text-neutral-500">
              <tr>
                <th className="py-3 pr-4">Дата</th>
                <th className="py-3 pr-4">Переходы</th>
                <th className="py-3 pr-4">Уникальные</th>
                <th className="py-3 pr-4">Фильмы</th>
                <th className="py-3 pr-4">Старты</th>
                <th className="py-3 pr-4">Видеопоказы</th>
                <th className="py-3 pr-4">Клики</th>
                <th className="py-3 pr-4">Доход</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee]">
              {rows.map((row) => (
                <tr key={row.date}>
                  <td className="py-3 pr-4 font-bold">{row.date}</td>
                  <td className="py-3 pr-4">{row.clicks}</td>
                  <td className="py-3 pr-4">{row.unique}</td>
                  <td className="py-3 pr-4">{row.movies}</td>
                  <td className="py-3 pr-4">{row.starts}</td>
                  <td className="py-3 pr-4">{row.videoViews}</td>
                  <td className="py-3 pr-4">{row.videoClicks}</td>
                  <td className="py-3 pr-4">{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">Последние партнёры</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {latestPartners.map((partner) => (
            <div key={partner.id} className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="font-black text-[#222]">{partner.publicName || partner.name}</div>
              <div className="mt-1 text-sm text-neutral-500">/{partner.slug} · {partner.status} · {partner.commissionPercent.toString()}%</div>
            </div>
          ))}
          {!latestPartners.length ? <div className="text-neutral-500">Партнёров пока нет.</div> : null}
        </div>
      </section>
    </CollaborationAdminShell>
  );
}
