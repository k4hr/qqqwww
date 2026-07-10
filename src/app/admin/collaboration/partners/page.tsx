import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminChangePartnerCommission, adminCreatePartner, adminEndPartnerAttributions, adminResetPartnerPassword, adminSetPartnerStatus, adminUpdatePartner } from "@/app/admin/collaboration/actions";
import { buttonClass, CollaborationAdminShell, Field, ghostButtonClass, inputClass } from "@/app/admin/collaboration/_components";
import { siteUrl } from "@/lib/seo-links";
import { ImageUploadField } from "@/components/image-upload-field";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnersPage({ searchParams }: Props) {
  const params = await searchParams;
  const [partners, hubs] = await Promise.all([
    prisma.partner.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.creatorHub.findMany({ select: { partnerId: true, slug: true } }),
  ]);
  const hubByPartner = new Map(hubs.map((hub) => [hub.partnerId, hub]));
  const created = first(params.created);
  const password = first(params.password);

  return (
    <CollaborationAdminShell title="Партнёры" description="Создание блогеров, ручной процент, срок атрибуции, статус и доступ к подборкам.">
      {created && password ? (
        <div className="admin-panel mb-6 border-l-4 border-[#e50914] p-5">
          <h2 className="text-xl font-black text-[#222]">Партнёр создан. Пароль показывается один раз.</h2>
          <div className="mt-3 grid gap-2 text-sm text-[#222]">
            <div>Адрес кабинета: <b>{siteUrl("/partner/login")}</b></div>
            <div>Логин: <b>{created}</b></div>
            <div>Временный пароль: <b>{password}</b></div>
          </div>
        </div>
      ) : null}

      <section className="admin-panel p-5">
        <h2 className="text-xl font-black text-[#222]">Создать партнёра</h2>
        <form action={adminCreatePartner} encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Имя"><input name="name" required className={inputClass} /></Field>
          <Field label="Публичное имя"><input name="publicName" className={inputClass} /></Field>
          <Field label="Название кабинета"><input name="cabinetTitle" className={inputClass} /></Field>
          <Field label="Slug"><input name="slug" required className={inputClass} placeholder="syilers" /></Field>
          <Field label="Логин"><input name="login" required className={inputClass} /></Field>
          <Field label="Пароль"><input name="password" minLength={8} className={inputClass} placeholder="минимум 8 символов или пусто для генерации" /></Field>
          <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
          <ImageUploadField name="avatarImage" label="Аватар блогера" />
          <ImageUploadField name="coverImage" label="Обложка страницы блогера" />
          <Field label="Процент"><input name="commissionPercent" defaultValue="30" className={inputClass} /></Field>
          <Field label="Срок атрибуции, дней"><input name="attributionDays" defaultValue="30" className={inputClass} /></Field>
          <Field label="Модель"><select name="attributionModel" className={inputClass}><option value="FIRST_CLICK_LOCKED">FIRST_CLICK_LOCKED</option><option value="LAST_CLICK">LAST_CLICK</option></select></Field>
          <Field label="Статус"><select name="status" className={inputClass}><option value="ACTIVE">ACTIVE</option><option value="PAUSED">PAUSED</option><option value="BLOCKED">BLOCKED</option></select></Field>
          <Field label="Описание"><textarea name="description" className={`${inputClass} min-h-24`} /></Field>
          <Field label="Комментарий администратора"><textarea name="adminComment" className={`${inputClass} min-h-24`} /></Field>
          <div className="grid gap-2 rounded-2xl border border-[#eee] p-3 text-sm font-bold text-[#333]">
            <label><input name="canManageCollections" type="checkbox" defaultChecked /> Разрешить подборки</label>
            <label><input name="requireCollectionModeration" type="checkbox" defaultChecked /> Требовать модерацию</label>
            <label><input name="showFinancials" type="checkbox" defaultChecked /> Показывать финансы</label>
          </div>
          <div className="md:col-span-2 xl:col-span-3"><button className={buttonClass}>Создать партнёра</button></div>
        </form>
      </section>

      <section className="mt-6 grid gap-4">
        {partners.map((partner) => {
          const hub = hubByPartner.get(partner.id);
          return (
            <article key={partner.id} className="admin-panel p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#222]">{partner.publicName || partner.name}</h2>
                  <div className="mt-1 text-sm text-neutral-500">/{partner.slug} · login: {partner.login} · {partner.status} · {partner.commissionPercent.toString()}%</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link className={ghostButtonClass} href={`/partner?preview=${partner.slug}`}>Кабинет</Link>
                    <Link className={ghostButtonClass} href={`/collections/${hub?.slug || partner.slug}`}>Публичная страница</Link>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <form action={adminSetPartnerStatus}><input type="hidden" name="partnerId" value={partner.id} /><input type="hidden" name="status" value={partner.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} /><button className={ghostButtonClass}>{partner.status === "ACTIVE" ? "Приостановить" : "Активировать"}</button></form>
                  <form action={adminSetPartnerStatus}><input type="hidden" name="partnerId" value={partner.id} /><input type="hidden" name="status" value="BLOCKED" /><button className={ghostButtonClass}>Заблокировать</button></form>
                  <form action={adminEndPartnerAttributions}><input type="hidden" name="partnerId" value={partner.id} /><button className={ghostButtonClass}>Завершить атрибуции</button></form>
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-[#eee] p-4">
                <summary className="cursor-pointer font-black text-[#222]">Редактировать</summary>
                <form action={adminUpdatePartner} encType="multipart/form-data" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <input type="hidden" name="id" value={partner.id} />
                  <Field label="Имя"><input name="name" defaultValue={partner.name} className={inputClass} /></Field>
                  <Field label="Публичное имя"><input name="publicName" defaultValue={partner.publicName || ""} className={inputClass} /></Field>
                  <Field label="Название кабинета"><input name="cabinetTitle" defaultValue={partner.cabinetTitle || ""} className={inputClass} /></Field>
                  <Field label="Slug"><input name="slug" defaultValue={partner.slug} className={inputClass} /></Field>
                  <Field label="Email"><input name="email" defaultValue={partner.email || ""} className={inputClass} /></Field>
                  <ImageUploadField name="avatarImage" label="Аватар блогера" currentUrl={partner.avatarUrl} />
                  <ImageUploadField name="coverImage" label="Обложка страницы блогера" currentUrl={partner.coverUrl} />
                  <Field label="Срок атрибуции"><input name="attributionDays" defaultValue={partner.attributionDays} className={inputClass} /></Field>
                  <Field label="Модель"><select name="attributionModel" defaultValue={partner.attributionModel} className={inputClass}><option value="FIRST_CLICK_LOCKED">FIRST_CLICK_LOCKED</option><option value="LAST_CLICK">LAST_CLICK</option></select></Field>
                  <Field label="Статус"><select name="status" defaultValue={partner.status} className={inputClass}><option value="ACTIVE">ACTIVE</option><option value="PAUSED">PAUSED</option><option value="BLOCKED">BLOCKED</option></select></Field>
                  <Field label="Описание"><textarea name="description" defaultValue={partner.description || ""} className={`${inputClass} min-h-24`} /></Field>
                  <Field label="Комментарий"><textarea name="adminComment" defaultValue={partner.adminComment || ""} className={`${inputClass} min-h-24`} /></Field>
                  <div className="grid gap-2 rounded-2xl border border-[#eee] p-3 text-sm font-bold text-[#333]">
                    <label><input name="canManageCollections" type="checkbox" defaultChecked={partner.canManageCollections} /> Разрешить подборки</label>
                    <label><input name="requireCollectionModeration" type="checkbox" defaultChecked={partner.requireCollectionModeration} /> Требовать модерацию</label>
                    <label><input name="showFinancials" type="checkbox" defaultChecked={partner.showFinancials} /> Показывать финансы</label>
                    <label><input name="linksBlocked" type="checkbox" defaultChecked={partner.linksBlocked} /> Заблокировать ссылки</label>
                  </div>
                  <div className="md:col-span-2 xl:col-span-3"><button className={buttonClass}>Сохранить</button></div>
                </form>
              </details>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <form action={adminChangePartnerCommission} className="rounded-2xl border border-[#eee] p-4">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <Field label="Изменить процент"><input name="percent" defaultValue={partner.commissionPercent.toString()} className={inputClass} /></Field>
                  <p className="mt-2 text-xs text-neutral-500">Старые закрытые периоды не пересчитываются.</p>
                  <button className={`${buttonClass} mt-3`}>Сохранить процент</button>
                </form>
                <form action={adminResetPartnerPassword} className="rounded-2xl border border-[#eee] p-4">
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <Field label="Новый пароль"><input name="password" minLength={8} className={inputClass} placeholder="пусто = сгенерировать" /></Field>
                  <button className={`${buttonClass} mt-3`}>Сбросить пароль</button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
    </CollaborationAdminShell>
  );
}
