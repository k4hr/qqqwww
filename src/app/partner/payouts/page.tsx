import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { PartnerShell } from "@/app/partner/_components";
import { formatMoney } from "@/lib/collaboration/stats";

export const dynamic = "force-dynamic";

export default async function PartnerPayoutsPage() {
  const { partner } = await requirePartnerSession();
  const payouts = await prisma.partnerPayout.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <PartnerShell title="Выплаты" description="История выплат и статусы. Создаёт и подтверждает выплаты администратор.">
      <div className="grid gap-4">
        {payouts.map((payout) => (
          <article key={payout.id} className="mf-panel p-5">
            <div className="font-black text-white">{formatMoney(payout.amount, payout.currency)} · {payout.status}</div>
            <div className="mt-1 text-sm text-[#a1a1aa]">{payout.periodFrom.toISOString().slice(0, 10)} — {payout.periodTo.toISOString().slice(0, 10)} {payout.paidAt ? `· paid ${payout.paidAt.toISOString().slice(0, 10)}` : ""}</div>
            {payout.comment ? <p className="mt-2 text-sm text-[#a1a1aa]">{payout.comment}</p> : null}
          </article>
        ))}
        {!payouts.length ? <div className="mf-panel p-5 text-[#a1a1aa]">Выплат пока нет.</div> : null}
      </div>
    </PartnerShell>
  );
}
