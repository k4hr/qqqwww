import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PLAYER_START_RATE = "0.00307000";
export const DEFAULT_VIDEO_VIEW_RATE = "0.00220000";
export const DEFAULT_VIDEO_CLICK_RATE = "0.04473000";

export async function getCurrentMonetizationRate(at = new Date()) {
  const rate = await prisma.monetizationRate.findFirst({
    where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
    orderBy: { effectiveFrom: "desc" },
  });
  if (rate) return rate;
  return prisma.monetizationRate.create({
    data: {
      playerStartRate: new Prisma.Decimal(DEFAULT_PLAYER_START_RATE),
      videoViewRate: new Prisma.Decimal(DEFAULT_VIDEO_VIEW_RATE),
      videoClickRate: new Prisma.Decimal(DEFAULT_VIDEO_CLICK_RATE),
      currency: "USD",
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
}

export function calculateGrossRevenue(input: {
  playerStarts: number;
  videoViews: number;
  videoClicks: number;
  playerStartRate: Prisma.Decimal;
  videoViewRate: Prisma.Decimal;
  videoClickRate: Prisma.Decimal;
}) {
  return input.playerStartRate
    .mul(input.playerStarts)
    .add(input.videoViewRate.mul(input.videoViews))
    .add(input.videoClickRate.mul(input.videoClicks));
}

export function calculatePartnerCommission(grossRevenue: Prisma.Decimal, percent: Prisma.Decimal) {
  return grossRevenue.mul(percent).div(100);
}
