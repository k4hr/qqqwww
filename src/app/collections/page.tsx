import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { publicCollections } from "@/lib/collections";

export const revalidate = 900;

export const metadata = {
  title: "Подборки фильмов и сериалов — REDFILM",
  description: "Авторские подборки блогеров и редакционные подборки REDFILM.",
  alternates: { canonical: "/collections" },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const current =
    (Array.isArray(params.view) ? params.view[0] : params.view) === "redfilm"
      ? "redfilm"
      : "bloggers";

  const collectionCounts =
    current === "bloggers"
      ? await prisma.creatorCollection.groupBy({
          where: { status: "PUBLISHED" },
          by: ["partnerId"],
          _count: { _all: true },
        })
      : [];

  const partnerIdsWithPublishedCollections = collectionCounts
    .filter((row) => row._count._all > 0)
    .map((row) => row.partnerId);

  const [hubs, partners] =
    current === "bloggers" && partnerIdsWithPublishedCollections.length > 0
      ? await Promise.all([
          prisma.creatorHub.findMany({
            where: {
              isPublished: true,
              partnerId: { in: partnerIdsWithPublishedCollections },
            },
            orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
          }),
          prisma.partner.findMany({
            where: {
              id: { in: partnerIdsWithPublishedCollections },
              status: "ACTIVE",
            },
          }),
        ])
      : [[], []];

  const partnerById = new Map(
    partners.map((partner) => [partner.id, partner]),
  );

  const countByPartner = new Map(
    collectionCounts.map((row) => [row.partnerId, row._count._all]),
  );

  return (
    <div className="container py-6">
      <section className="rf-catalog-intro">
        <div className="rf-section-eyebrow mb-3">Коллекции REDFILM</div>
        <h1 className="rf-page-title">Подборки фильмов и сериалов</h1>
        <p className="rf-copy mt-4 max-w-2xl">Тематические коллекции редакции и авторов: от жанровых маршрутов до коротких списков на один вечер.</p>
      </section>

      <div className="rf-filter-row mt-6">
        <Link
          href="/collections?view=bloggers"
          className={`rf-filter ${
            current === "bloggers"
              ? "rf-filter-active"
              : ""
          }`}
        >
          Подборки блогеров
        </Link>

        <Link
          href="/collections?view=redfilm"
          className={`rf-filter ${
            current === "redfilm"
              ? "rf-filter-active"
              : ""
          }`}
        >
          Подборки REDFILM
        </Link>
      </div>

      {current === "bloggers" ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {hubs.map((hub) => {
            const partner = partnerById.get(hub.partnerId);
            if (!partner) return null;

            return (
              <Link
                key={hub.id}
                href={`/collections/${hub.slug}`}
                className="collections-author-card group overflow-hidden rounded-[13px] transition"
              >
                <div className="collections-author-card-cover relative h-44 overflow-hidden bg-white/[0.025]">
                  {hub.coverUrl ? (
                    <Image
                      src={hub.coverUrl}
                      alt={hub.title}
                      fill
                      unoptimized
                      sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      className="collections-author-card-image block object-cover"
                    />
                  ) : null}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  {partner.avatarUrl ? (
                    <Image
                      src={partner.avatarUrl}
                      alt={partner.publicName || partner.name}
                      width={72}
                      height={72}
                      unoptimized
                      className="absolute bottom-4 left-4 h-18 w-18 rounded-full border-2 border-white object-cover"
                    />
                  ) : null}
                </div>

                <div className="collections-author-card-body px-1 pb-1 pt-3">
                  <h2 className="text-[16px] font-medium text-[#ececef]">
                    {partner.publicName || partner.name}
                  </h2>

                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#74757d]">
                    {hub.description ||
                      partner.description ||
                      "Авторские подборки фильмов и сериалов."}
                  </p>

                  <div className="mt-2.5 text-xs font-medium text-[#6f7179]">
                    Подборок: {countByPartner.get(partner.id) || 0}
                  </div>
                </div>
              </Link>
            );
          })}

          {!hubs.length ? (
            <div className="border-y border-white/[.07] py-8 text-[#a1a1aa]">
              Опубликованных подборок блогеров пока нет.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-8 grid gap-x-7 md:grid-cols-2 lg:grid-cols-3">
          {publicCollections.map((collection, index) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group border-t border-white/[.08] py-5 transition-colors hover:border-white/[.18]"
            >
              <div className="mb-5 text-xs font-medium tracking-[.12em] text-[#74757d]">{String(index + 1).padStart(2, "0")}</div>
              <h2 className="mb-2 text-[17px] font-medium text-[#e8e8eb] transition-colors group-hover:text-white">
                {collection.h1}
              </h2>

              <p className="text-sm leading-6 text-[#7f8189]">
                {collection.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
