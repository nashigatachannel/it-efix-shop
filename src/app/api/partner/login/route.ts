import { NextRequest, NextResponse } from "next/server";
import {
  authenticatePartner,
  createPartnerToken,
  setPartnerCookie,
} from "@/lib/partner-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // timing-attack 対策で固定遅延
  await new Promise((r) => setTimeout(r, 250));

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "メールアドレスとパスワードを入力してください" },
      { status: 400 }
    );
  }

  let profile;
  try {
    profile = await authenticatePartner(body.email, body.password);
  } catch (err) {
    console.error("Partner master lookup failed:", err);
    return NextResponse.json(
      { error: "認証に失敗しました（管理者にお問い合わせください）" },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await createPartnerToken(profile);
  await setPartnerCookie(token);
  return NextResponse.json({
    ok: true,
    companyName: profile.companyName,
    tier: profile.tier,
  });
}
