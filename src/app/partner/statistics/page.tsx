import { requirePartnerSession } from "@/lib/collaboration/auth";
import { PartnerShell } from "@/app/partner/_components";
import { formatMoney, getPartnerDailyRows, getPartnerEventSummary } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function PartnerStatisticsPage() {
  const { partner } = await requirePartnerSession();
  const [summary, rows] = await Promise.all([getPartnerEventSummary(partner.id), getPartnerDailyRows(partner.id, 30)]);
  return (
    <PartnerShell title="Статистика" description="Переходы, уникальные посетители, открытия фильмов, старты плеера и рекламные события.">
      <section className="mf-panel p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-white">
          <div>Переходов 30 дней: <b>{summary.clicks30}</b></div>
          <div>Уникальных: <b>{summary.uniqueVisitors}</b></div>
          <div>Открытий фильмов: <b>{summary.movieOpens}</b></div>
          <div>Стартов плеера: <b>{summary.playerStarts}</b></div>
        </div>
      </section>
      <section className="mf-panel mt-6 p-5 overflow-x-auto">
        <table className="w-full text-sm text-white/80">
          <thead className="border-b border-white/10 text-left text-[#a1a1aa]"><tr><th className="py-3 pr-4">Дата</th><th className="py-3 pr-4">Переходы</th><th className="py-3 pr-4">Уникальные</th><th className="py-3 pr-4">Фильмы</th><th className="py-3 pr-4">Старты</th><th className="py-3 pr-4">Показы</th><th className="py-3 pr-4">Клики</th><th className="py-3 pr-4">Доход</th></tr></thead>
          <tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.date}><td className="py-3 pr-4 font-bold text-white">{row.date}</td><td className="py-3 pr-4">{row.clicks}</td><td className="py-3 pr-4">{row.unique}</td><td className="py-3 pr-4">{row.movies}</td><td className="py-3 pr-4">{row.starts}</td><td className="py-3 pr-4">{row.videoViews}</td><td className="py-3 pr-4">{row.videoClicks}</td><td className="py-3 pr-4">{partner.showFinancials ? formatMoney(row.revenue) : "скрыто"}</td></tr>)}</tbody>
        </table>
      </section>
    </PartnerShell>
  );
}
