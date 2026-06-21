import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const take = 50;
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.trendCandidate.findMany({ where, orderBy: { sourceScore: "desc" }, skip: (page - 1) * take, take }),
    prisma.trendCandidate.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pages: Math.ceil(total / take) });
}
