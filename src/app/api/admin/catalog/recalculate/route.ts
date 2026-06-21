import { NextResponse } from "next/server";
import { recalculateAllCatalogScores } from "@/lib/catalog-score";
import { prisma } from "@/lib/prisma";
import { recalculateAllHomeScores } from "@/lib/trend-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const startedAt = new Date();
  const run = await prisma.catalogEngineRun.create({
    data: {
      status: "RUNNING",
      mode: "manual-admin-recalculate",
      startedAt,
      message: "Полный пересчёт каталога запущен из админки.",
    },
  });

  try {
    const catalog = await recalculateAllCatalogScores();
    const home = await recalculateAllHomeScores();
    const finishedAt = new Date();
    const message = [
      `processed=${catalog.processed}`,
      `publicVisible=${catalog.publicVisible}`,
      `popularEligible=${catalog.popularEligible}`,
      `topEligible=${catalog.topEligible}`,
      `freshEligible=${catalog.freshEligible}`,
      `homeProcessed=${home.processed}`,
      `homeEligible=${home.homeEligible}`,
      `heroEligible=${home.heroEligible}`,
      `errors=${catalog.errors + home.errors}`,
    ].join("; ");

    await prisma.catalogEngineRun.update({
      where: { id: run.id },
      data: {
        status: catalog.errors || home.errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        found: catalog.processed,
        updated: catalog.processed,
        failed: catalog.errors + home.errors,
        message,
        finishedAt,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "manual-admin-recalculate",
      startedAt,
      finishedAt,
      catalog,
      home,
      message,
    });
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Catalog recalculation failed";
    await prisma.catalogEngineRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        failed: 1,
        message,
        finishedAt,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
