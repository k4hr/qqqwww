import { prisma } from "@/lib/prisma";
import { adminCalculateRevenuePeriod, adminConfirmRevenuePeriod } from "@/app/admin/collaboration/actions";
import { buttonClass, CollaborationAdminShell, Field, inputClass } from "@/app/admin/collaboration/_components";
import { formatMoney } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function CollaborationRevenuePage() {
  const [partners, periods] = await Promise.all([
    prisma.partner.findMany({ orderBy: { publicName: "asc" }, take: 200 }),
    prisma.partnerRevenuePeriod.findMany({ orderBy: { periodFrom: "desc" }, take: 100 }),
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  return (
    <CollaborationAdminShell title="Доход" description="Расчётные периоды, снимки ставок и процента, подтверждение дохода и ручные корректировки.">
      <section className="admin-panel p-5">
        <h2 className="text-xl font-black text-[#222]">Сформировать расчёт за период</h2>
        <form action={adminCalculateRevenuePeriod} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Партнёр"><select name="partnerId" className={inputClass}>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.publicName || partner.name}</option>)}</select></Field>
          <Field label="Тип периода"><select name="periodType" className={inputClass}><option value="DAILY">DAILY</option><option value="WEEKLY">WEEKLY</option><option value="MONTHLY">MONTHLY</option><option value="CUSTOM">CUSTOM</option></select></Field>
          <Field label="С"><input name="periodFrom" type="datetime-local" required className={inputClass} /></Field>
          <Field label="По"><input name="periodTo" type="datetime-local" required className={inputClass} /></Field>
          <div className="mt-6"><button className={buttonClass}>Рассчитать</button></div>
        </form>
      </section>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">Периоды</h2>
        <div className="mt-4 grid gap-4">
          {periods.map((period) => (
            <article key={period.id} className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="font-black text-[#222]">{partnerById.get(period.partnerId)?.publicName || partnerById.get(period.partnerId)?.name || period.partnerId}</div>
              <div className="mt-1 text-sm text-neutral-500">{period.periodFrom.toISOString().slice(0, 10)} — {period.periodTo.toISOString().slice(0, 10)} · {period.status} · starts {period.playerStarts}</div>
              <div className="mt-2 text-sm text-[#222]">Расчётный доход: <b>{formatMoney(period.estimatedGrossRevenue, period.currency)}</b> · партнёру: <b>{formatMoney(period.partnerCommission, period.currency)}</b> · процент snapshot: {period.commissionPercentSnapshot.toString()}%</div>
              <form action={adminConfirmRevenuePeriod} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <input type="hidden" name="id" value={period.id} />
                <Field label="Подтверждённый доход"><input name="confirmedGrossRevenue" defaultValue={(period.confirmedGrossRevenue || period.estimatedGrossRevenue).toString()} className={inputClass} /></Field>
                <Field label="Корректировка"><input name="manualAdjustment" defaultValue={period.manualAdjustment.toString()} className={inputClass} /></Field>
                <button className={buttonClass}>Подтвердить</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </CollaborationAdminShell>
  );
}
