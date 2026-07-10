import { prisma } from "@/lib/prisma";
import { adminSaveMonetizationRate } from "@/app/admin/collaboration/actions";
import { buttonClass, CollaborationAdminShell, Field, inputClass } from "@/app/admin/collaboration/_components";

export const dynamic = "force-dynamic";

export default async function CollaborationSettingsPage() {
  const rates = await prisma.monetizationRate.findMany({ orderBy: { effectiveFrom: "desc" }, take: 20 });
  const current = rates[0];
  return (
    <CollaborationAdminShell title="Настройки сотрудничества" description="Глобальные ставки монетизации. Партнёры не могут менять эти значения.">
      <section className="admin-panel p-5">
        <h2 className="text-xl font-black text-[#222]">Новая ставка</h2>
        <form action={adminSaveMonetizationRate} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Старт плеера"><input name="playerStartRate" defaultValue={current?.playerStartRate.toString() || "0.00307"} className={inputClass} /></Field>
          <Field label="Видеопоказ"><input name="videoViewRate" defaultValue={current?.videoViewRate.toString() || "0.00220"} className={inputClass} /></Field>
          <Field label="Видеоклик"><input name="videoClickRate" defaultValue={current?.videoClickRate.toString() || "0.04473"} className={inputClass} /></Field>
          <Field label="Валюта"><input name="currency" defaultValue={current?.currency || "USD"} className={inputClass} /></Field>
          <Field label="Дата начала"><input name="effectiveFrom" type="datetime-local" className={inputClass} /></Field>
          <div className="md:col-span-2 xl:col-span-5"><button className={buttonClass}>Сохранить ставки</button></div>
        </form>
      </section>
      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">История ставок</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-[#222]">
            <thead className="border-b border-[#e5e5e5] text-left text-neutral-500"><tr><th className="py-3 pr-4">С даты</th><th className="py-3 pr-4">До</th><th className="py-3 pr-4">Старт</th><th className="py-3 pr-4">Показ</th><th className="py-3 pr-4">Клик</th><th className="py-3 pr-4">Валюта</th></tr></thead>
            <tbody className="divide-y divide-[#eee]">{rates.map((rate) => <tr key={rate.id}><td className="py-3 pr-4">{rate.effectiveFrom.toISOString()}</td><td className="py-3 pr-4">{rate.effectiveTo?.toISOString() || "активна"}</td><td className="py-3 pr-4">{rate.playerStartRate.toString()}</td><td className="py-3 pr-4">{rate.videoViewRate.toString()}</td><td className="py-3 pr-4">{rate.videoClickRate.toString()}</td><td className="py-3 pr-4">{rate.currency}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </CollaborationAdminShell>
  );
}
