import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePartnerSession } from "@/lib/collaboration/auth";
import { PartnerShell } from "@/app/partner/_components";

export const dynamic = "force-dynamic";

export default async function PartnerCollectionsPage() {
  const { partner } = await requirePartnerSession();
  const collections = await prisma.creatorCollection.findMany({ where: { partnerId: partner.id }, orderBy: [{ position: "asc" }, { createdAt: "desc" }] });
  return (
    <PartnerShell title="Мои подборки" description="Черновики, модерация и опубликованные авторские подборки.">
      <div className="mb-5"><Link href="/partner/collections/new" className="rounded-xl bg-[#e50914] px-4 py-3 font-black text-white">Создать подборку</Link></div>
      <div className="grid gap-4 md:grid-cols-2">
        {collections.map((collection) => (
          <Link key={collection.id} href={`/partner/collections/${collection.id}`} className="mf-panel block p-5 hover:border-[#e50914]/50">
            <div className="text-xl font-black text-white">{collection.title}</div>
            <div className="mt-1 text-sm text-[#a1a1aa]">{collection.status} · /{collection.slug}</div>
            <p className="mt-3 line-clamp-2 text-sm text-[#a1a1aa]">{collection.description || "Описание не добавлено."}</p>
          </Link>
        ))}
        {!collections.length ? <div className="mf-panel p-5 text-[#a1a1aa]">Подборок пока нет.</div> : null}
      </div>
    </PartnerShell>
  );
}
