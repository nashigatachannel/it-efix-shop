import { NextRequest, NextResponse } from "next/server";
import { verifyPayToken } from "@/lib/pay-token";
import { findInvoiceRow } from "@/lib/sales-sheet";

export const dynamic = "force-dynamic";

interface LookupRequestBody {
  token?: string;
}

const INVALID_TOKEN_MESSAGE =
  "このリンクは無効です。お手数ですがEFIX担当までご連絡ください";
const EXPIRED_TOKEN_MESSAGE =
  "このリンクの有効期限が切れています。お手数ですがEFIX担当までご連絡ください";
const NOT_FOUND_MESSAGE =
  "対応する請求書が見つかりませんでした。お手数ですがEFIX担当までご連絡ください";
const LOOKUP_FAILED_MESSAGE =
  "請求書情報の取得に失敗しました。時間をおいて再度お試しください";

// INV番号の直接指定は受け付けない(列挙攻撃防止)。必ず署名付きトークン経由でのみ照会できる。
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LookupRequestBody;
  try {
    body = (await request.json()) as LookupRequestBody;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const token = body.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "支払いリンクが指定されていません" },
      { status: 400 },
    );
  }

  const verified = verifyPayToken(token);
  if (!verified.ok) {
    const message =
      verified.error === "expired" ? EXPIRED_TOKEN_MESSAGE : INVALID_TOKEN_MESSAGE;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let invoice;
  try {
    invoice = await findInvoiceRow(verified.inv);
  } catch (err) {
    console.error("Failed to look up invoice row:", err);
    return NextResponse.json({ error: LOOKUP_FAILED_MESSAGE }, { status: 500 });
  }

  if (!invoice) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return NextResponse.json({
    invDisplay: invoice.invDisplay,
    customerName: invoice.customerName,
    amountJpy: invoice.amountJpy,
    alreadyPaid: invoice.paidDate.length > 0,
  });
}
