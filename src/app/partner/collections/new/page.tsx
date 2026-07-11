import { partnerCreateCollection } from "@/app/partner/actions";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { requirePartnerSession } from "@/lib/collaboration/auth";

export const dynamic = "force-dynamic";

export default async function NewPartnerCollectionPage() {
  await requirePartnerSession();
  return (
    <PartnerShell title="Новая подборка" description="Придумайте название и добавьте описание. Обложкой автоматически станет постер первого фильма в подборке.">
      <section className="mf-panel p-5">
        <form action={partnerCreateCollection} className="grid gap-4">
          <PartnerField label="Название подборки"><input name="title" required className={partnerInput} placeholder="Например: Сериалы на вечер" /></PartnerField>
          <PartnerField label="Описание подборки"><textarea name="description" className={`${partnerInput} min-h-32`} placeholder="Расскажите, какие фильмы или сериалы собраны в этой подборке" /></PartnerField>
          <div><button className={partnerButton}>Создать подборку</button></div>
        </form>
      </section>
    </PartnerShell>
  );
}
