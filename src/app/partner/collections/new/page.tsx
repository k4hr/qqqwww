import { partnerCreateCollection } from "@/app/partner/actions";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { requirePartnerSession } from "@/lib/collaboration/auth";

export const dynamic = "force-dynamic";

export default async function NewPartnerCollectionPage() {
  await requirePartnerSession();
  return (
    <PartnerShell title="Новая подборка" description="Создайте тематическую подборку, затем добавьте фильмы из каталога REDFILM.">
      <section className="mf-panel p-5">
        <form action={partnerCreateCollection} className="grid gap-3 md:grid-cols-2">
          <PartnerField label="Название"><input name="title" required className={partnerInput} /></PartnerField>
          <PartnerField label="Slug"><input name="slug" required className={partnerInput} /></PartnerField>
          <PartnerField label="Обложка"><input name="coverUrl" className={partnerInput} /></PartnerField>
          <PartnerField label="Позиция"><input name="position" defaultValue="0" className={partnerInput} /></PartnerField>
          <PartnerField label="Короткое описание"><textarea name="description" className={`${partnerInput} min-h-28`} /></PartnerField>
          <div className="md:col-span-2"><button className={partnerButton}>Создать</button></div>
        </form>
      </section>
    </PartnerShell>
  );
}
