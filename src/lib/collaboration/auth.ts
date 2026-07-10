import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashNullable, randomToken, sha256 } from "@/lib/collaboration/security";

export const PARTNER_SESSION_COOKIE = "rf_partner_session";
export const PARTNER_VISITOR_COOKIE = "rf_visitor";
export const PARTNER_COOKIE = "rf_partner";
export const PARTNER_LINK_COOKIE = "rf_partner_link";
export const PARTNER_ATTRIBUTED_AT_COOKIE = "rf_attributed_at";
export const PARTNER_ATTRIBUTION_EXPIRES_COOKIE = "rf_attribution_expires_at";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

export function partnerCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS, httpOnly = true) {
  return {
    httpOnly,
    secure: secureCookie(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createPartnerSession(partnerId: string) {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.partnerSession.create({ data: { partnerId, tokenHash, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(PARTNER_SESSION_COOKIE, token, partnerCookieOptions());
  return token;
}

export async function clearPartnerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARTNER_SESSION_COOKIE)?.value;
  if (token) {
    await prisma.partnerSession.deleteMany({ where: { tokenHash: sha256(token) } }).catch(() => undefined);
  }
  cookieStore.delete(PARTNER_SESSION_COOKIE);
}

export async function getPartnerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARTNER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.partnerSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.partnerSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const partner = await prisma.partner.findUnique({ where: { id: session.partnerId } });
  if (!partner || partner.status !== "ACTIVE") return null;

  await prisma.partnerSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return { session, partner };
}

export async function requirePartnerSession() {
  const auth = await getPartnerSession();
  if (!auth) redirect("/partner/login");
  return auth;
}

export async function getRequestFingerprint(request?: Request) {
  const requestHeaders = request ? request.headers : await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") || "";
  const realIp = requestHeaders.get("x-real-ip") || "";
  const userAgent = requestHeaders.get("user-agent") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || realIp.trim();
  return {
    ipHash: hashNullable(ip),
    userAgentHash: hashNullable(userAgent),
    userAgent,
  };
}

export async function getOrCreateVisitor(request?: Request) {
  const cookieStore = await cookies();
  const existing = cookieStore.get(PARTNER_VISITOR_COOKIE)?.value;
  const visitorId = existing || randomToken(18);
  const fingerprint = await getRequestFingerprint(request);

  const visitor = await prisma.partnerVisitor.upsert({
    where: { visitorId },
    update: {
      lastVisitAt: new Date(),
      ipHash: fingerprint.ipHash,
      userAgentHash: fingerprint.userAgentHash,
    },
    create: {
      visitorId,
      ipHash: fingerprint.ipHash,
      userAgentHash: fingerprint.userAgentHash,
    },
  });

  cookieStore.set(PARTNER_VISITOR_COOKIE, visitorId, partnerCookieOptions(VISITOR_MAX_AGE_SECONDS));
  return visitor;
}

export async function setAttributionCookies(partnerId: string, partnerLinkId: string | null, startedAt: Date, expiresAt: Date) {
  const cookieStore = await cookies();
  const maxAge = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  cookieStore.set(PARTNER_COOKIE, partnerId, partnerCookieOptions(maxAge));
  if (partnerLinkId) cookieStore.set(PARTNER_LINK_COOKIE, partnerLinkId, partnerCookieOptions(maxAge));
  cookieStore.set(PARTNER_ATTRIBUTED_AT_COOKIE, startedAt.toISOString(), partnerCookieOptions(maxAge));
  cookieStore.set(PARTNER_ATTRIBUTION_EXPIRES_COOKIE, expiresAt.toISOString(), partnerCookieOptions(maxAge));
}

export async function getActiveAttributionForVisitor(visitorId: string) {
  return prisma.partnerAttribution.findFirst({
    where: { visitorId, isActive: true, expiresAt: { gt: new Date() } },
    orderBy: { startedAt: "desc" },
  });
}
