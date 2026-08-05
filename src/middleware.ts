import { NextRequest, NextResponse } from "next/server";
import { PRIVATE_CACHE_CONTROL, isPrivateCachePath, publicCacheControlForPath } from "@/lib/cache-control";

const CONTENT_PREFIXES = ["/watch", "/season", "/similar", "/like", "/collections", "/person"];
const PLAYBACK_PREFIXES = ["/watch", "/season"];

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function pathStartsWithPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function gone(message: string) {
  return new NextResponse(message, {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "Cache-Control": PRIVATE_CACHE_CONTROL,
    },
  });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Canonical host and HTTPS redirects are intentionally handled by the public
  // reverse proxy. The origin may receive a rewritten Host header, so doing
  // hostname redirects here can redirect www.redfilm.win back to itself.

  const emergencyDeindexMode = envFlag("EMERGENCY_DEINDEX_MODE", false);
  const publicPlaybackEnabled = envFlag("PUBLIC_PLAYBACK_ENABLED", true);

  if (emergencyDeindexMode && pathStartsWithPrefix(pathname, CONTENT_PREFIXES)) {
    return gone("REDFILM content pages are temporarily unavailable during migration.");
  }

  if (!publicPlaybackEnabled && pathStartsWithPrefix(pathname, PLAYBACK_PREFIXES)) {
    return gone("REDFILM playback pages are disabled.");
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      return new NextResponse("ADMIN_PASSWORD is not configured in server environment variables.", { status: 503 });
    }

    const header = request.headers.get("authorization");
    if (!header?.startsWith("Basic ")) return unauthorized();

    const encoded = header.slice(6);
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      return unauthorized();
    }

    const separatorIndex = decoded.indexOf(":");
    const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : "";
    const pass = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

    if (user !== username || pass !== password) return unauthorized();
  }

  const response = NextResponse.next();
  const isPrivatePath = isPrivateCachePath(pathname);
  response.headers.set("Cache-Control", isPrivatePath ? PRIVATE_CACHE_CONTROL : publicCacheControlForPath(pathname));

  if (isPrivatePath) {
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }

  const publicIndexingEnabled = envFlag("PUBLIC_INDEXING_ENABLED", true);
  if (!publicIndexingEnabled && !pathname.startsWith("/api") && !pathname.startsWith("/admin")) {
    response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  }

  return response;
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="REDFILM Admin"',
      "Cache-Control": PRIVATE_CACHE_CONTROL,
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-icon.png|apple-touch-icon.png|icon.png).*)"],
};
