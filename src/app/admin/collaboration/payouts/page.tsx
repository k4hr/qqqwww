import { prisma } from "@/lib/prisma";
import { adminCreatePayout, adminMarkPayoutPaid } from "@/app/admin/collaboration/actions";
import { buttonClass, CollaborationAdminShell, Field, inputClass } from "@/app/admin/collaboration/_components";
import { formatMoney } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function CollaborationPayoutsPage() {
  const [partners, periods, payouts] = await Promise.all([
    prisma.partner.findMany({ orderBy: { publicName: "asc" }, take: 200 }),
    prisma.partnerRevenuePeriod.findMany({ where: { status: { in: ["CONFIRMED", "CLOSED"] } }, orderBy: { periodFrom: "desc" }, take: 100 }),
    prisma.partnerPayout.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));

  return (
    <CollaborationAdminShell title="Выплаты" description="Создание выплат и отметка фактической оплаты.">
      <section className="admin-panel p-5">
        <h2 className="text-xl font-black text-[#222]">Создать выплату</h2>
        <form action={adminCreatePayout} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Партнёр"><select name="partnerId" className={inputClass}>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.publicName || partner.name}</option>)}</select></Field>
          <Field label="Период"><select name="revenuePeriodId" className={inputClass}><option value="">Без периода</option>{periods.map((period) => <option key={period.id} value={period.id}>{partnerById.get(period.partnerId)?.publicName || period.partnerId}: {period.periodFrom.toISOString().slice(0, 10)} — {formatMoney(period.partnerCommission, period.currency)}</option>)}</select></Field>
          <Field label="С"><input name="periodFrom" type="datetime-local" required className={inputClass} /></Field>
          <Field label="По"><input name="periodTo" type="datetime-local" required className={inputClass} /></Field>
          <Field label="Сумма"><input name="amount" required className={inputClass} /></Field>
          <Field label="Валюта"><input name="currency" defaultValue="USD" className={inputClass} /></Field>
          <Field label="Статус"><select name="status" className={inputClass}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="PAID">PAID</option><option value="CANCELLED">CANCELLED</option></select></Field>
          <Field label="Комментарий"><input name="comment" className={inputClass} /></Field>
          <div className="md:col-span-2 xl:col-span-4"><button className={buttonClass}>Создать выплату</button></div>
        </form>
      </section>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">История выплат</h2>
        <div className="mt-4 grid gap-4">
          {payouts.map((payout) => (
            <article key={payout.id} className="rounded-2xl border border-[#e5e5e5] p-4">
              <div className="font-black text-[#222]">{partnerById.get(payout.partnerId)?.publicName || payout.partnerId} · {formatMoney(payout.amount, payout.currency)}</div>
              <div className="mt-1 text-sm text-neutral-500">{payout.periodFrom.toISOString().slice(0, 10)} — {payout.periodTo.toISOString().slice(0, 10)} · {payout.status} {payout.paidAt ? `· paid ${payout.paidAt.toISOString()}` : ""}</div>
              <form action={adminMarkPayoutPaid} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={payout.id} />
                <Field label="Статус"><select name="status" defaultValue={payout.status} className={inputClass}><option value="PENDING">PENDING</option><option value="APPROVED">APPROVED</option><option value="PAID">PAID</option><option value="CANCELLED">CANCELLED</option></select></Field>
                <Field label="Комментарий"><input name="comment" defaultValue={payout.comment || ""} className={inputClass} /></Field>
                <button className={buttonClass}>Обновить</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </CollaborationAdminShell>
  );
}
