import { partnerCreateCollection } from "@/app/partner/actions";
import { PartnerField, partnerButton, partnerInput, PartnerShell } from "@/app/partner/_components";
import { ImageUploadField } from "@/components/image-upload-field";
import { requirePartnerSession } from "@/lib/collaboration/auth";

export const dynamic = "force-dynamic";

export default async function NewPartnerCollectionPage() {
  await requirePartnerSession();
  return (
    <PartnerShell title="Новая подборка" description="Придумайте название, добавьте описание и обложку. Ссылка создастся автоматически.">
      <section className="mf-panel p-5">
        <form action={partnerCreateCollection} className="grid gap-4" encType="multipart/form-data">
          <PartnerField label="Название подборки"><input name="title" required className={partnerInput} placeholder="Например: Сериалы на вечер" /></PartnerField>
          <PartnerField label="Описание подборки"><textarea name="description" className={`${partnerInput} min-h-32`} placeholder="Расскажите, какие фильмы или сериалы собраны в этой подборке" /></PartnerField>
          <ImageUploadField name="coverImage" label="Обложка подборки" dark />
          <div><button className={partnerButton}>Создать подборку</button></div>
        </form>
      </section>
    </PartnerShell>
  );
}
