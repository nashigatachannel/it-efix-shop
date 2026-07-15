import { NextRequest, NextResponse } from "next/server";
import { createPayToken } from "@/lib/pay-token";

export const dynamic = "force-dynamic";

interface GenerateRequestBody {
  invNumber?: number;
}

// 認証は middleware.ts の legacyAdminPartnerRouting が /api/admin/* 全体に対して既にかけている。
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const invNumber = body.invNumber;
  if (typeof invNumber !== "number" || !Number.isInteger(invNumber) || invNumber < 1) {
    return NextResponse.json({ error: "invNumber が不正です" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.efix-shop.jp";

  try {
    const token = createPayToken(invNumber);
    return NextResponse.json({ url: `${baseUrl}/pay?t=${token}` });
  } catch (err) {
    console.error("Failed to create pay token:", err);
    return NextResponse.json(
      { error: "支払いリンクの生成に失敗しました" },
      { status: 500 },
    );
  }
}
