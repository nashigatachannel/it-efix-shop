import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_COOKIE = "efix_admin";
const WHOLESALE_COOKIE = "efix_wholesale";
const DISTRIBUTOR_COOKIE = "efix_distributor";

async function isValidJwt(
  token: string | undefined,
  secret: string | undefined,
  expectedRole?: "wholesale" | "distributor"
): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );
    if (expectedRole) {
      return payload.role === expectedRole;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ===== Admin =====
  if (pathname.startsWith("/admin/login") || pathname === "/api/admin/login") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (await isValidJwt(token, process.env.ADMIN_AUTH_SECRET)) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ===== Wholesale =====
  if (
    pathname.startsWith("/wholesale/login") ||
    pathname === "/api/wholesale/login"
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/wholesale") ||
    pathname.startsWith("/api/wholesale")
  ) {
    const token = request.cookies.get(WHOLESALE_COOKIE)?.value;
    if (await isValidJwt(token, process.env.ROLE_AUTH_SECRET, "wholesale")) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/wholesale/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ===== Distributor (特価卸) =====
  if (
    pathname.startsWith("/distributor/login") ||
    pathname === "/api/distributor/login"
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/distributor") ||
    pathname.startsWith("/api/distributor")
  ) {
    const token = request.cookies.get(DISTRIBUTOR_COOKIE)?.value;
    if (await isValidJwt(token, process.env.ROLE_AUTH_SECRET, "distributor")) {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/distributor/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/wholesale/:path*",
    "/api/wholesale/:path*",
    "/distributor/:path*",
    "/api/distributor/:path*",
  ],
};
