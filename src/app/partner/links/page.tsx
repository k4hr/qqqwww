import { prisma } from "@/lib/prisma";
import { partnerCreateLink } from "@/app/partner/actions";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { CopyButton } from "@/components/copy-button";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { siteUrl } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export default async function PartnerLinksPage() {
  const { partner } = await requirePartnerSession();
  const [links, collections] = await Promise.all([
    prisma.partnerLink.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" } }),
    prisma.creatorCollection.findMany({ where: { partnerId: partner.id }, orderBy: { position: "asc" } }),
  ]);
  return (
    <PartnerShell title="Мои ссылки" description="Создавайте ссылки для Instagram, Telegram, VK, MAX и отдельных подборок.">
      <section className="mf-panel p-5">
        <h2 className="text-xl font-black text-white">Создать ссылку</h2>
        {partner.linksBlocked ? <p className="mt-3 text-[#ff4d55]">Администратор временно заблокировал создание ссылок.</p> : (
          <form action={partnerCreateLink} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <PartnerField label="Название"><input name="name" required className={partnerInput} /></PartnerField>
            <PartnerField label="Slug"><input name="slug" required className={partnerInput} /></PartnerField>
            <PartnerField label="Источник"><select name="source" className={partnerInput}><option value="">Без источника</option><option value="instagram">Instagram</option><option value="telegram">Telegram</option><option value="vk">VK</option><option value="max">MAX</option></select></PartnerField>
            <PartnerField label="Тип"><select name="targetType" className={partnerInput}><option value="AUTHOR_HUB">Авторская страница</option><option value="COLLECTION">Подборка</option><option value="MOVIE">Фильм</option><option value="CUSTOM">Произвольная</option></select></PartnerField>
            <PartnerField label="Подборка"><select name="collectionId" className={partnerInput}><option value="">Не выбрано</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></PartnerField>
            <PartnerField label="Target URL"><input name="targetUrl" className={partnerInput} placeholder={`/collections/${partner.slug}`} /></PartnerField>
            <div className="md:col-span-2 xl:col-span-3"><button className={partnerButton}>Создать</button></div>
          </form>
        )}
      </section>

      <section className="mt-6 grid gap-3">
        <div className="mf-panel p-5">
          <div className="text-sm text-[#a1a1aa]">Основная ссылка</div>
          <div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-black/35 px-3 py-2 text-white">{siteUrl(`/go/${partner.slug}`)}</code><CopyButton value={siteUrl(`/go/${partner.slug}`)} /></div>
        </div>
        {links.map((link) => {
          const url = siteUrl(`/go/${partner.slug}/${link.slug}${link.source ? `?src=${encodeURIComponent(link.source)}` : ""}`);
          return <div key={link.id} className="mf-panel p-5"><div className="font-black text-white">{link.name}</div><div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-black/35 px-3 py-2 text-white">{url}</code><CopyButton value={url} /></div><div className="mt-2 text-sm text-[#a1a1aa]">{link.targetType} · {link.source || "без источника"}</div></div>;
        })}
      </section>
    </PartnerShell>
  );
}
