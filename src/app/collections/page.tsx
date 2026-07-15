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

  const hubs =
    current === "bloggers"
      ? await prisma.creatorHub.findMany({
          where: { isPublished: true },
          orderBy: { updatedAt: "desc" },
        })
      : [];

  const partnerIds = hubs.map((hub) => hub.partnerId);

  const [partners, collectionCounts] =
    current === "bloggers"
      ? await Promise.all([
          prisma.partner.findMany({
            where: {
              id: { in: partnerIds },
              status: "ACTIVE",
            },
          }),
          prisma.creatorCollection.groupBy({
            where: {
              partnerId: { in: partnerIds },
              status: "PUBLISHED",
            },
            by: ["partnerId"],
            _count: { _all: true },
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
      <h1 className="text-3xl font-black tracking-[-.035em] text-white">
        Подборки фильмов и сериалов
      </h1>

      <div className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <Link
          href="/collections?view=bloggers"
          className={`rounded-xl px-4 py-2 text-sm font-black ${
            current === "bloggers"
              ? "bg-[#e50914] text-white"
              : "text-white/70"
          }`}
        >
          Подборки блогеров
        </Link>

        <Link
          href="/collections?view=redfilm"
          className={`rounded-xl px-4 py-2 text-sm font-black ${
            current === "redfilm"
              ? "bg-[#e50914] text-white"
              : "text-white/70"
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
                className="mf-panel overflow-hidden p-0 hover:border-[#e50914]/50"
              >
                <div className="relative h-44 overflow-hidden bg-white/[0.04]">
                  {hub.coverUrl ? (
                    <Image
                      src={hub.coverUrl}
                      alt={hub.title}
                      fill
                      unoptimized
                      sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
                      className="block object-cover"
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

                <div className="p-5">
                  <h2 className="text-xl font-black text-white">
                    {partner.publicName || partner.name}
                  </h2>

                  <p className="mt-2 line-clamp-2 text-sm text-[#a1a1aa]">
                    {hub.description ||
                      partner.description ||
                      "Авторские подборки фильмов и сериалов."}
                  </p>

                  <div className="mt-4 text-sm font-bold text-[#ff4d55]">
                    Подборок: {countByPartner.get(partner.id) || 0}
                  </div>
                </div>
              </Link>
            );
          })}

          {!hubs.length ? (
            <div className="mf-panel p-5 text-[#a1a1aa]">
              Опубликованных подборок блогеров пока нет.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {publicCollections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="glass-panel section-glow rounded-3xl p-5 transition-all hover:-translate-y-1 hover:border-[#e50914]/60"
            >
              <h2 className="mb-2 text-xl font-black text-white">
                {collection.h1}
              </h2>

              <p className="leading-relaxed text-[#a1a1aa]">
                {collection.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
