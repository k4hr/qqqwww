import Link from "next/link";
import type { ReactNode } from "react";
import { partnerLogout } from "@/app/partner/actions";

const nav = [
  ["/partner", "Обзор"],
  ["/partner/links", "Мои ссылки"],
  ["/partner/collections", "Мои подборки"],
  ["/partner/statistics", "Статистика"],
  ["/partner/revenue", "Доход"],
  ["/partner/payouts", "Выплаты"],
  ["/partner/settings", "Настройки"],
] as const;

export function PartnerShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="container py-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">{title}</h1>
          <p className="mt-1 max-w-3xl text-[#a1a1aa]">{description}</p>
        </div>
        <form action={partnerLogout}><button className="mf-btn">Выйти</button></form>
      </div>
      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        {nav.map(([href, label]) => <Link key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white">{label}</Link>)}
      </nav>
      {children}
    </div>
  );
}

export function PartnerStat({ title, value }: { title: string; value: ReactNode }) {
  return <div className="mf-panel p-5"><div className="text-sm text-[#a1a1aa]">{title}</div><div className="mt-2 text-3xl font-black text-[#ff4d55]">{value}</div></div>;
}

export function PartnerField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-bold text-white"><span>{label}</span>{children}</label>;
}

export const partnerInput = "rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#e50914]";
export const partnerButton = "rounded-xl bg-[#e50914] px-4 py-2 text-sm font-black text-white hover:bg-[#c9000b]";
