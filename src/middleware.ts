import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");

  if (!isLocalhost && forwardedProto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  if (request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/api/admin")) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      return new NextResponse("ADMIN_PASSWORD is not configured in Railway Variables.", { status: 503 });
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

  return NextResponse.next();
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="REDFILM Admin"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-icon.png|apple-touch-icon.png|icon.png).*)"],
};
