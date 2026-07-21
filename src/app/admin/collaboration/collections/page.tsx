import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  adminModerateCollection,
  adminUpdateCreatorHubPosition,
} from "@/app/admin/collaboration/actions";
import {
  buttonClass,
  CollaborationAdminShell,
  Field,
  inputClass,
} from "@/app/admin/collaboration/_components";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const errorMessages: Record<string, string> = {
  id: "Не передан идентификатор подборки.",
  not_found: "Подборка не найдена. Обновите страницу и повторите действие.",
  broken_relation: "У подборки повреждена связь с партнёром или публичной страницей.",
  partner_inactive: "Нельзя опубликовать подборку: партнёр не находится в статусе ACTIVE.",
  empty_collection: "Нельзя опубликовать пустую подборку. Добавьте хотя бы один доступный фильм или сериал.",
};

export default async function AdminCreatorCollectionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = firstParam(params.error);
  const moderated = firstParam(params.moderated) === "1";
  const moderatedStatus = firstParam(params.status);

  const [collections, partners, hubs, publishedCounts] = await Promise.all([
    prisma.creatorCollection.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.partner.findMany({ take: 200 }),
    prisma.creatorHub.findMany({
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.creatorCollection.groupBy({
      where: { status: "PUBLISHED" },
      by: ["partnerId"],
      _count: { _all: true },
    }),
  ]);

  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const hubById = new Map(hubs.map((hub) => [hub.id, hub]));
  const publishedCountByPartner = new Map(
    publishedCounts.map((row) => [row.partnerId, row._count._all]),
  );

  return (
    <CollaborationAdminShell
      title="Авторские подборки"
      description="Очередь модерации, публикация подборок и порядок партнёров на публичной странице /collections."
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">
          {errorMessages[error] || "Не удалось изменить статус подборки."}
        </div>
      ) : null}

      {moderated ? (
        <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          Статус подборки сохранён{moderatedStatus ? `: ${moderatedStatus}` : ""}. Публичные страницы и ссылки обновлены.
        </div>
      ) : null}

      <section className="admin-panel mb-6 p-5">
        <h2 className="text-xl font-black text-[#222]">
          Порядок партнёров на странице подборок
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Чем меньше число, тем выше карточка. Партнёр без опубликованных подборок
          автоматически не показывается на публичной странице.
        </p>

        <div className="mt-4 grid gap-3">
          {hubs.map((hub) => {
            const partner = partnerById.get(hub.partnerId);
            const publishedCount = publishedCountByPartner.get(hub.partnerId) || 0;

            return (
              <form
                key={hub.id}
                action={adminUpdateCreatorHubPosition}
                className="grid gap-3 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end"
              >
                <input type="hidden" name="id" value={hub.id} />

                <div>
                  <div className="font-black text-[#222]">
                    {partner?.publicName || partner?.name || hub.title}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    /collections/{hub.slug} · опубликованных подборок: {publishedCount}
                    {!hub.isPublished ? " · хаб скрыт" : ""}
                  </div>
                </div>

                <Field label="Позиция">
                  <input
                    name="position"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={hub.position}
                    className={inputClass}
                  />
                </Field>

                <button className={buttonClass}>Сохранить порядок</button>
              </form>
            );
          })}

          {!hubs.length ? (
            <div className="text-neutral-500">Партнёрских страниц пока нет.</div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4">
        {collections.map((collection) => {
          const partner = partnerById.get(collection.partnerId);
          const hub = hubById.get(collection.hubId);
          const isPublic = Boolean(
            collection.status === "PUBLISHED" &&
              hub?.isPublished &&
              partner?.status === "ACTIVE",
          );

          return (
            <article key={collection.id} className="admin-panel p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black text-[#222]">
                    {collection.title}
                  </h2>
                  <div className="mt-1 text-sm text-neutral-500">
                    {partner?.publicName || partner?.name || collection.partnerId} ·{" "}
                    {collection.status} · /collections/{hub?.slug}/{collection.slug}
                  </div>
                  {collection.description ? (
                    <p className="mt-2 text-sm text-neutral-600">
                      {collection.description}
                    </p>
                  ) : null}
                </div>

                {hub && isPublic ? (
                  <Link
                    className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-bold text-[#333]"
                    href={`/collections/${hub.slug}/${collection.slug}`}
                  >
                    Открыть опубликованную страницу
                  </Link>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#ddd] px-4 py-2 text-sm font-bold text-neutral-500">
                    Публичная страница пока скрыта
                  </div>
                )}
              </div>

              <form
                action={adminModerateCollection}
                className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end"
              >
                <input type="hidden" name="id" value={collection.id} />
                <Field label="Статус">
                  <select
                    name="status"
                    defaultValue={collection.status}
                    className={inputClass}
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </Field>
                <Field label="Комментарий модератора">
                  <input
                    name="moderationComment"
                    defaultValue={collection.moderationComment || ""}
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className={buttonClass}>Сохранить и применить</button>
              </form>
            </article>
          );
        })}

        {!collections.length ? (
          <div className="admin-panel p-5 text-neutral-500">
            Подборок пока нет.
          </div>
        ) : null}
      </section>
    </CollaborationAdminShell>
  );
}
