import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { CopyButton } from "@/components/copy-button";
import { PartnerShell } from "@/app/partner/_components";
import { siteUrl } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export default async function PartnerSettingsPage() {
  const { partner } = await requirePartnerSession();
  const hub = await prisma.creatorHub.findUnique({ where: { partnerId: partner.id } });
  const url = siteUrl(`/collections/${hub?.slug || partner.slug}`);
  return (
    <PartnerShell title="Настройки" description="Профиль партнёра и правила атрибуции. Изменения процента выполняет только администратор.">
      <section className="mf-panel p-5">
        <div className="grid gap-3 text-sm text-white md:grid-cols-2">
          <div>Публичное имя: <b>{partner.publicName || partner.name}</b></div>
          <div>Slug: <b>{partner.slug}</b></div>
          <div>Модель атрибуции: <b>{partner.attributionModel}</b></div>
          <div>Срок атрибуции: <b>{partner.attributionDays} дней</b></div>
          <div>Процент: <b>{partner.commissionPercent.toString()}%</b></div>
          <div>Модерация подборок: <b>{partner.requireCollectionModeration ? "включена" : "выключена"}</b></div>
        </div>
        <div className="mt-5">
          <div className="text-sm text-[#a1a1aa]">Публичная страница</div>
          <div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-black/35 px-3 py-2 text-white">{url}</code><CopyButton value={url} /></div>
        </div>
      </section>
    </PartnerShell>
  );
}
