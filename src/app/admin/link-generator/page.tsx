import Link from "next/link";
import { getLinkGeneratorStats } from "@/lib/admin-link-generator";
import { LINK_GENERATOR_CONTENT_TYPES } from "@/lib/link-generator-types";
import { LinkGeneratorClient } from "./link-generator-client";

export const dynamic = "force-dynamic";

export default async function LinkGeneratorPage() {
  const initialTypes = [...LINK_GENERATOR_CONTENT_TYPES];
  const initialStats = await getLinkGeneratorStats(initialTypes);

  return (
    <div className="container admin-shell py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-3 text-sm">
            <Link href="/admin" className="font-bold text-[#e50914]">← В админку</Link>
          </div>
          <h1 className="text-3xl font-black text-[#222]">Генератор ссылок</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
            Случайные ссылки REDFILM из локальной базы с разбивкой по длительности. В выборку попадают только опубликованные карточки, разрешённые в каталоге и имеющие Vibix-плеер.
          </p>
        </div>
      </div>

      <LinkGeneratorClient initialStats={initialStats} initialTypes={initialTypes} />
    </div>
  );
}
