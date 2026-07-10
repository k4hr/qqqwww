import Link from "next/link";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { estimatedCommission, formatMoney, getPartnerDailyRows, getPartnerEventSummary } from "@/lib/collaboration/stats";
import { PartnerShell, PartnerStat } from "@/app/partner/_components";
import { siteUrl } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const { partner } = await requirePartnerSession();
  const [summary, rows] = await Promise.all([getPartnerEventSummary(partner.id), getPartnerDailyRows(partner.id, 14)]);
  const commission = estimatedCommission(summary.estimatedGrossRevenue, partner.commissionPercent);

  return (
    <PartnerShell title={partner.cabinetTitle || `Кабинет ${partner.publicName || partner.name}`} description="Ваши ссылки, подборки, статистика и расчётное вознаграждение.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PartnerStat title="Переходов сегодня" value={summary.clicksToday} />
        <PartnerStat title="Переходов за 7 дней" value={summary.clicks7} />
        <PartnerStat title="Переходов за 30 дней" value={summary.clicks30} />
        <PartnerStat title="Уникальных пользователей" value={summary.uniqueVisitors} />
        <PartnerStat title="Повторных посетителей" value={summary.returnVisits} />
        <PartnerStat title="Открытий фильмов" value={summary.movieOpens} />
        <PartnerStat title="Стартов плеера" value={summary.playerStarts} />
        <PartnerStat title="Расчётный доход" value={partner.showFinancials ? formatMoney(summary.estimatedGrossRevenue) : "скрыто"} />
        <PartnerStat title="Ваш процент" value={`${partner.commissionPercent.toString()}%`} />
        <PartnerStat title="Расчётное вознаграждение" value={partner.showFinancials ? formatMoney(commission) : "скрыто"} />
        <PartnerStat title="К выплате" value={partner.showFinancials ? formatMoney(summary.payable) : "скрыто"} />
        <PartnerStat title="Выплачено" value={partner.showFinancials ? formatMoney(summary.paid) : "скрыто"} />
      </div>

      <section className="mf-panel mt-6 p-5">
        <h2 className="text-xl font-black text-white">Основная ссылка</h2>
        <p className="mt-2 text-[#a1a1aa]">{siteUrl(`/go/${partner.slug}`)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/partner/links" className="mf-btn">Создать ссылки по источникам</Link>
          <Link href="/partner/collections" className="mf-btn">Управлять подборками</Link>
        </div>
      </section>

      <section className="mf-panel mt-6 p-5">
        <h2 className="text-xl font-black text-white">Динамика по дням</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-white/80">
            <thead className="border-b border-white/10 text-left text-[#a1a1aa]"><tr><th className="py-3 pr-4">Дата</th><th className="py-3 pr-4">Переходы</th><th className="py-3 pr-4">Уникальные</th><th className="py-3 pr-4">Фильмы</th><th className="py-3 pr-4">Старты</th><th className="py-3 pr-4">Видеопоказы</th><th className="py-3 pr-4">Клики</th><th className="py-3 pr-4">Доход</th></tr></thead>
            <tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.date}><td className="py-3 pr-4 font-bold text-white">{row.date}</td><td className="py-3 pr-4">{row.clicks}</td><td className="py-3 pr-4">{row.unique}</td><td className="py-3 pr-4">{row.movies}</td><td className="py-3 pr-4">{row.starts}</td><td className="py-3 pr-4">{row.videoViews}</td><td className="py-3 pr-4">{row.videoClicks}</td><td className="py-3 pr-4">{partner.showFinancials ? formatMoney(row.revenue) : "скрыто"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </PartnerShell>
  );
}
