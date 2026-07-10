import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateGrossRevenue, calculatePartnerCommission, getCurrentMonetizationRate } from "@/lib/collaboration/revenue";

export function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function daysAgo(days: number) {
  const next = startOfDay();
  next.setDate(next.getDate() - days);
  return next;
}

export async function getPartnerEventSummary(partnerId?: string) {
  const now = new Date();
  const today = startOfDay(now);
  const last7 = daysAgo(6);
  const last30 = daysAgo(29);
  const whereBase = partnerId ? { partnerId } : {};
  const rate = await getCurrentMonetizationRate();

  const [
    activePartners,
    clicksToday,
    clicks7,
    clicks30,
    uniqueVisitors,
    returnVisits,
    movieOpens,
    playerStarts,
    videoViews,
    videoClicks,
    confirmed,
    payoutsPaid,
  ] = await Promise.all([
    partnerId ? Promise.resolve(1) : prisma.partner.count({ where: { status: "ACTIVE" } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "LINK_CLICK", createdAt: { gte: today } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "LINK_CLICK", createdAt: { gte: last7 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "LINK_CLICK", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "UNIQUE_VISITOR", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "RETURN_VISIT", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "MOVIE_OPEN", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "PLAYER_START", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "AD_VIEW", createdAt: { gte: last30 } } }),
    prisma.partnerEvent.count({ where: { ...whereBase, type: "AD_CLICK", createdAt: { gte: last30 } } }),
    prisma.partnerRevenuePeriod.aggregate({ where: { ...whereBase, status: { in: ["CONFIRMED", "CLOSED", "PAID"] } }, _sum: { partnerCommission: true, confirmedGrossRevenue: true } }),
    prisma.partnerPayout.aggregate({ where: { ...whereBase, status: "PAID" }, _sum: { amount: true } }),
  ]);

  const grossRevenue = calculateGrossRevenue({
    playerStarts,
    videoViews,
    videoClicks,
    playerStartRate: rate.playerStartRate,
    videoViewRate: rate.videoViewRate,
    videoClickRate: rate.videoClickRate,
  });

  return {
    activePartners,
    clicksToday,
    clicks7,
    clicks30,
    uniqueVisitors,
    returnVisits,
    movieOpens,
    playerStarts,
    videoViews,
    videoClicks,
    estimatedGrossRevenue: grossRevenue,
    confirmedGrossRevenue: confirmed._sum.confirmedGrossRevenue || new Prisma.Decimal(0),
    payable: confirmed._sum.partnerCommission || new Prisma.Decimal(0),
    paid: payoutsPaid._sum.amount || new Prisma.Decimal(0),
  };
}

export async function getPartnerDailyRows(partnerId?: string, days = 14) {
  const from = daysAgo(days - 1);
  const events = await prisma.partnerEvent.findMany({
    where: { ...(partnerId ? { partnerId } : {}), createdAt: { gte: from } },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 20_000,
  });
  const rate = await getCurrentMonetizationRate();
  const rows = new Map<string, { date: string; clicks: number; unique: number; movies: number; starts: number; videoViews: number; videoClicks: number; revenue: Prisma.Decimal }>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = daysAgo(index).toISOString().slice(0, 10);
    rows.set(day, { date: day, clicks: 0, unique: 0, movies: 0, starts: 0, videoViews: 0, videoClicks: 0, revenue: new Prisma.Decimal(0) });
  }
  for (const event of events) {
    const key = event.createdAt.toISOString().slice(0, 10);
    const row = rows.get(key);
    if (!row) continue;
    if (event.type === "LINK_CLICK") row.clicks += 1;
    if (event.type === "UNIQUE_VISITOR") row.unique += 1;
    if (event.type === "MOVIE_OPEN") row.movies += 1;
    if (event.type === "PLAYER_START") row.starts += 1;
    if (event.type === "AD_VIEW") row.videoViews += 1;
    if (event.type === "AD_CLICK") row.videoClicks += 1;
  }
  for (const row of rows.values()) {
    row.revenue = calculateGrossRevenue({
      playerStarts: row.starts,
      videoViews: row.videoViews,
      videoClicks: row.videoClicks,
      playerStartRate: rate.playerStartRate,
      videoViewRate: rate.videoViewRate,
      videoClickRate: rate.videoClickRate,
    });
  }
  return Array.from(rows.values());
}

export function formatMoney(value: Prisma.Decimal | null | undefined, currency = "USD") {
  const amount = value ? Number(value.toString()) : 0;
  return `${amount.toFixed(4)} ${currency}`;
}

export function estimatedCommission(gross: Prisma.Decimal, percent: Prisma.Decimal) {
  return calculatePartnerCommission(gross, percent);
}
