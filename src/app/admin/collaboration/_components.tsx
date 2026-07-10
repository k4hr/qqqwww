import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  ["/admin/collaboration", "Обзор"],
  ["/admin/collaboration/partners", "Партнёры"],
  ["/admin/collaboration/links", "Ссылки"],
  ["/admin/collaboration/collections", "Авторские подборки"],
  ["/admin/collaboration/revenue", "Доход"],
  ["/admin/collaboration/payouts", "Выплаты"],
  ["/admin/collaboration/settings", "Настройки"],
] as const;

export function CollaborationAdminShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="container admin-shell py-6">
      <div className="mb-5">
        <Link href="/admin" className="text-sm font-bold text-[#e50914]">← Админка</Link>
        <h1 className="mt-2 text-3xl font-black text-[#222]">{title}</h1>
        <p className="mt-1 max-w-4xl text-neutral-600">{description}</p>
      </div>
      <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-[#e5e5e5] bg-white p-2">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-[#333] hover:bg-[#f4f4f5] hover:text-[#e50914]">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function AdminStat({ title, value, hint }: { title: string; value: ReactNode; hint?: string }) {
  return (
    <div className="admin-panel p-5">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-2 text-3xl font-black text-[#e50914]">{value}</div>
      {hint ? <div className="mt-2 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-[#333]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "rounded-xl border border-[#ddd] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#e50914]";
export const buttonClass = "rounded-xl bg-[#e50914] px-4 py-2 text-sm font-black text-white hover:bg-[#c9000b]";
export const ghostButtonClass = "rounded-xl border border-[#ddd] bg-white px-4 py-2 text-sm font-bold text-[#333] hover:bg-[#f4f4f5]";
