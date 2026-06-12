import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_COOKIE = "efix_admin";
const PARTNER_COOKIE = "efix_partner";
const DEV_PARTNER_AUTH_SECRET =
  "efix-local-development-partner-secret-20260527";

function authSecret(secret: string | undefined, devSecret?: string): string | undefined {
  if (!secret && devSecret && process.env.NODE_ENV !== "production") {
    return devSecret;
  }
  return secret;
}

async function isValidJwt(
  token: string | undefined,
  secret: string | undefined,
  validate?: (payload: Record<string, unknown>) => boolean,
): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] },
    );
    if (validate && !validate(payload as Record<string, unknown>)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy distributor URLs are consolidated into the partner area.
  if (pathname === "/distributor" || pathname === "/distributor/login") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.endsWith("/login") ? "/partner/login" : "/partner";
    return NextResponse.redirect(url);
  }

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

  if (
    pathname.startsWith("/partner/login") ||
    pathname === "/api/partner/login"
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/partner") || pathname.startsWith("/api/partner")) {
    const token = request.cookies.get(PARTNER_COOKIE)?.value;
    const valid = await isValidJwt(
      token,
      authSecret(process.env.PARTNER_AUTH_SECRET, DEV_PARTNER_AUTH_SECRET),
      (p) =>
        typeof p.partnerId === "string" &&
        (p.tier === "wholesale" || p.tier === "distributor"),
    );
    if (valid) return NextResponse.next();

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/partner/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/partner/:path*",
    "/api/partner/:path*",
    "/distributor/:path*",
  ],
};
