import { prisma } from "@/lib/prisma";
import { adminCreatePartnerLink } from "@/app/admin/collaboration/actions";
import { buttonClass, CollaborationAdminShell, Field, inputClass } from "@/app/admin/collaboration/_components";
import { siteUrl } from "@/lib/seo-links";

export const dynamic = "force-dynamic";

export default async function AdminPartnerLinksPage() {
  const [partners, links] = await Promise.all([
    prisma.partner.findMany({ orderBy: { publicName: "asc" }, take: 200 }),
    prisma.partnerLink.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));

  return (
    <CollaborationAdminShell title="Партнёрские ссылки" description="Персональные /go-ссылки с источниками и целевыми страницами.">
      <section className="admin-panel p-5">
        <h2 className="text-xl font-black text-[#222]">Создать ссылку</h2>
        <form action={adminCreatePartnerLink} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Партнёр"><select name="partnerId" required className={inputClass}>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.publicName || partner.name}</option>)}</select></Field>
          <Field label="Название"><input name="name" required className={inputClass} /></Field>
          <Field label="Slug"><input name="slug" required className={inputClass} placeholder="serialy-na-vecher" /></Field>
          <Field label="Источник"><input name="source" className={inputClass} placeholder="instagram / telegram / vk / max" /></Field>
          <Field label="Тип"><select name="targetType" className={inputClass}><option value="AUTHOR_HUB">AUTHOR_HUB</option><option value="COLLECTION">COLLECTION</option><option value="MOVIE">MOVIE</option><option value="HOME">HOME</option><option value="CUSTOM">CUSTOM</option></select></Field>
          <Field label="Target URL"><input name="targetUrl" className={inputClass} placeholder="/collections/syilers" /></Field>
          <Field label="Collection ID"><input name="collectionId" className={inputClass} /></Field>
          <Field label="Movie ID"><input name="movieId" className={inputClass} /></Field>
          <label className="mt-6 text-sm font-bold text-[#333]"><input name="isActive" type="checkbox" defaultChecked /> Активна</label>
          <div className="md:col-span-2 xl:col-span-3"><button className={buttonClass}>Создать ссылку</button></div>
        </form>
      </section>

      <section className="admin-panel mt-6 p-5">
        <h2 className="text-xl font-black text-[#222]">Ссылки</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-[#222]">
            <thead className="border-b border-[#e5e5e5] text-left text-neutral-500"><tr><th className="py-3 pr-4">Партнёр</th><th className="py-3 pr-4">Название</th><th className="py-3 pr-4">URL</th><th className="py-3 pr-4">Источник</th><th className="py-3 pr-4">Статус</th></tr></thead>
            <tbody className="divide-y divide-[#eee]">
              {links.map((link) => {
                const partner = partnerById.get(link.partnerId);
                const url = siteUrl(`/go/${partner?.slug || "partner"}/${link.slug}${link.source ? `?src=${encodeURIComponent(link.source)}` : ""}`);
                return (
                  <tr key={link.id}>
                    <td className="py-3 pr-4">{partner?.publicName || partner?.name || link.partnerId}</td>
                    <td className="py-3 pr-4 font-bold">{link.name}</td>
                    <td className="py-3 pr-4"><code className="rounded bg-[#f4f4f5] px-2 py-1">{url}</code></td>
                    <td className="py-3 pr-4">{link.source || "—"}</td>
                    <td className="py-3 pr-4">{link.isActive ? "ACTIVE" : "OFF"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </CollaborationAdminShell>
  );
}
