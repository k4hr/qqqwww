import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json(await prisma.movie.findMany({ where: { isHeroEligible: true }, orderBy: { homeScore: "desc" }, take: 12 }));
}
