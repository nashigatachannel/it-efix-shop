import { NextRequest, NextResponse } from "next/server";
import { verifyPayToken } from "@/lib/pay-token";
import { findInvoiceRow, upsertLineBinding } from "@/lib/sales-sheet";

export const dynamic = "force-dynamic";

interface LineBindingRequestBody {
  token?: string;
  userId?: string;
  displayName?: string;
}

/**
 * LINE(LIFF)プロフィールと顧客名を紐づける。
 * 決済フローを止めないことを最優先するため、失敗しても常に200を返し、詳細はログのみに出す。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as LineBindingRequestBody;
    const token = body.token;
    const userId = body.userId;
    const displayName = body.displayName ?? "";

    if (!token || typeof token !== "string" || !userId || typeof userId !== "string") {
      return NextResponse.json({ ok: false });
    }

    const verified = verifyPayToken(token);
    if (!verified.ok) {
      return NextResponse.json({ ok: false });
    }

    const invoice = await findInvoiceRow(verified.inv);
    if (!invoice) {
      return NextResponse.json({ ok: false });
    }

    await upsertLineBinding({
      customerName: invoice.customerName,
      userId,
      displayName,
      triggerInvDisplay: invoice.invDisplay,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to upsert LINE binding for invoice payment:", err);
    return NextResponse.json({ ok: false });
  }
}
