import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

const isClerkAccountRoute = createRouteMatcher(["/account(.*)", "/api/account(.*)"]);

/**
 * 既存の admin/partner Cookie(JWT)認証ロジック。1文字も挙動を変えていない。
 * Clerk 導入前は `middleware` としてそのままエクスポートされていた関数の中身。
 * admin/partner/distributor 以外の pathname では常に NextResponse.next() を返す
 * (=何もしない)ので、Clerk 側の処理を妨げない。
 */
async function legacyAdminPartnerRouting(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Legacy distributor URLs are consolidated into the partner area.
  if (pathname === "/distributor" || pathname === "/distributor/login") {
    const url = request.nextUrl.clone();
    url.pathname = pathname.endsWith("/login") ? "/partner/login" : "/partner";
    return NextResponse.redirect(url);
  }

  const isAdminLoginApi =
    pathname === "/api/admin/login" ||
    (process.env.NODE_ENV !== "production" &&
      pathname === "/api/admin/dev-login");

  if (pathname.startsWith("/admin/login") || isAdminLoginApi) {
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

/**
 * Clerk (顧客向け認証) と既存の admin/partner Cookie 認証を同一 middleware で共存させる。
 * clerkMiddleware のハンドラ内で legacyAdminPartnerRouting をそのまま呼び出すことで、
 * admin/partner/distributor の挙動を完全に維持しつつ、Clerk のセッション処理を全ルートに適用する。
 * /account 配下のみ auth.protect() でログイン必須にする(他のルートは全て公開のまま)。
 */
export default clerkMiddleware(async (auth, request) => {
  if (isClerkAccountRoute(request)) {
    await auth.protect();
  }
  return legacyAdminPartnerRouting(request);
});

export const config = {
  matcher: [
    // Clerk 公式推奨マッチャー: 静的ファイル(拡張子付きURL)と _next を除く全ルートで実行。
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
