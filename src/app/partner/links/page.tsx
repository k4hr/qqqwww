import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { CopyButton } from "@/components/copy-button";
import { PartnerShell } from "@/app/partner/_components";
import { siteUrl } from "@/lib/seo-links";
import { MovieReferralLinkBuilder } from "@/app/partner/links/movie-referral-link-builder";

export const dynamic = "force-dynamic";

export default async function PartnerLinksPage() {
  const { partner } = await requirePartnerSession();
  const collections = await prisma.creatorCollection.findMany({ where: { partnerId: partner.id }, orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  const links = await prisma.partnerLink.findMany({ where: { partnerId: partner.id, isActive: true }, select: { id: true, collectionId: true, slug: true } });
  const collectionLinkById = new Map(links.filter((link) => link.collectionId).map((link) => [link.collectionId!, link]));

  const stats = await Promise.all(collections.map(async (collection) => {
    const link = collectionLinkById.get(collection.id);
    if (!link) return { collectionId: collection.id, clicks: 0, unique: 0, starts: 0 };
    const [clicks, unique, starts] = await Promise.all([
      prisma.partnerEvent.count({ where: { partnerId: partner.id, partnerLinkId: link.id, type: "LINK_CLICK" } }),
      prisma.partnerEvent.count({ where: { partnerId: partner.id, partnerLinkId: link.id, type: "UNIQUE_VISITOR" } }),
      prisma.partnerEvent.count({ where: { partnerId: partner.id, partnerLinkId: link.id, type: "PLAYER_START" } }),
    ]);
    return { collectionId: collection.id, clicks, unique, starts };
  }));
  const statByCollection = new Map(stats.map((row) => [row.collectionId, row]));

  return (
    <PartnerShell title="Мои ссылки" description="Общая ссылка ведёт на вашу страницу, а для каждой подборки ссылка создаётся автоматически.">
      <section className="mf-panel p-5">
        <div className="text-sm text-[#a1a1aa]">Общая партнёрская ссылка</div>
        <div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-xl bg-black/35 px-3 py-2 text-white">{siteUrl(`/go/${partner.slug}`)}</code><CopyButton value={siteUrl(`/go/${partner.slug}`)} /></div>
        <p className="mt-3 text-sm text-[#a1a1aa]">Она ведёт на вашу страницу со всеми опубликованными подборками и учитывает пришедших пользователей.</p>
      </section>

      <div className="mt-6">
        <MovieReferralLinkBuilder partnerSlug={partner.slug} />
      </div>

      <section className="mt-6 grid gap-3">
        <h2 className="text-xl font-black text-white">Ссылки на подборки</h2>
        {collections.map((collection) => {
          const url = siteUrl(`/go/${partner.slug}/${collection.slug}`);
          const row = statByCollection.get(collection.id) || { clicks: 0, unique: 0, starts: 0 };
          return (
            <div key={collection.id} className="mf-panel p-5">
              <div className="font-black text-white">{collection.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-3"><code className="break-all rounded-xl bg-black/35 px-3 py-2 text-white">{url}</code><CopyButton value={url} /></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-[#a1a1aa]">Переходы</div><div className="mt-1 text-xl font-black text-white">{row.clicks}</div></div>
                <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-[#a1a1aa]">Уникальные</div><div className="mt-1 text-xl font-black text-white">{row.unique}</div></div>
                <div className="rounded-xl border border-white/10 p-3"><div className="text-xs text-[#a1a1aa]">Старты плеера</div><div className="mt-1 text-xl font-black text-white">{row.starts}</div></div>
              </div>
            </div>
          );
        })}
        {!collections.length ? <div className="mf-panel p-5 text-[#a1a1aa]">Создайте первую подборку — ссылка появится здесь автоматически.</div> : null}
      </section>
    </PartnerShell>
  );
}
