import { NextRequest, NextResponse } from "next/server";
import { getLinkGeneratorStats, sanitizeContentTypes } from "@/lib/admin-link-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rawTypes = request.nextUrl.searchParams.get("types")?.split(",") ?? [];
    const types = sanitizeContentTypes(rawTypes);
    const stats = await getLinkGeneratorStats(types);
    return NextResponse.json({ stats, types });
  } catch (error) {
    console.error("[LinkGenerator] Failed to calculate stats", error);
    return NextResponse.json({ error: "Не удалось получить статистику генератора" }, { status: 500 });
  }
}
