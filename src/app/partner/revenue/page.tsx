import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { PartnerShell } from "@/app/partner/_components";
import { formatMoney } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function PartnerRevenuePage() {
  const { partner } = await requirePartnerSession();
  const periods = await prisma.partnerRevenuePeriod.findMany({ where: { partnerId: partner.id }, orderBy: { periodFrom: "desc" }, take: 100 });
  return (
    <PartnerShell title="Доход" description="Расчётные и подтверждённые начисления. Процент меняет только администратор.">
      <section className="mf-panel p-5">
        <div className="text-white">Ваш текущий процент: <b>{partner.commissionPercent.toString()}%</b></div>
        {!partner.showFinancials ? <p className="mt-2 text-[#a1a1aa]">Финансовая статистика скрыта администратором.</p> : null}
      </section>
      <div className="mt-6 grid gap-4">
        {periods.map((period) => (
          <article key={period.id} className="mf-panel p-5">
            <div className="font-black text-white">{period.periodFrom.toISOString().slice(0, 10)} — {period.periodTo.toISOString().slice(0, 10)} · {period.status}</div>
            <div className="mt-2 grid gap-2 text-sm text-[#a1a1aa] md:grid-cols-3">
              <div>Старты: {period.playerStarts}</div>
              <div>Доход аудитории: {partner.showFinancials ? formatMoney(period.estimatedGrossRevenue, period.currency) : "скрыто"}</div>
              <div>Ваше вознаграждение: {partner.showFinancials ? formatMoney(period.partnerCommission, period.currency) : "скрыто"}</div>
            </div>
          </article>
        ))}
        {!periods.length ? <div className="mf-panel p-5 text-[#a1a1aa]">Периодов дохода пока нет.</div> : null}
      </div>
    </PartnerShell>
  );
}
