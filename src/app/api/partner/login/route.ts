import { NextRequest, NextResponse } from "next/server";
import {
  PARTNER_COOKIE,
  PARTNER_SESSION_TTL_SECONDS,
  authenticatePartner,
  createPartnerToken,
} from "@/lib/partner-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string; loginId?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // timing-attack 対策で固定遅延
  await new Promise((r) => setTimeout(r, 250));

  const loginId = body.email ?? body.loginId ?? "";

  if (!loginId || !body.password) {
    return NextResponse.json(
      { error: "IDまたはメールアドレスとパスワードを入力してください" },
      { status: 400 }
    );
  }

  let profile;
  try {
    profile = await authenticatePartner(loginId, body.password);
  } catch (err) {
    console.error("Partner master lookup failed:", err);
    return NextResponse.json(
      { error: "認証システムがEFIX販売シートに接続できません。管理者にお問い合わせください。" },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "IDまたはメールアドレス、またはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await createPartnerToken(profile);
  const response = NextResponse.json({
    ok: true,
    companyName: profile.companyName,
    tier: profile.tier,
  });
  response.cookies.set({
    name: PARTNER_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PARTNER_SESSION_TTL_SECONDS,
  });
  return response;
}
