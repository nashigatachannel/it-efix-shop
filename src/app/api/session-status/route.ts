import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { fetchWebOrders } from "@/lib/sheets";

/**
 * 「Web注文」シートから通し番号（注文番号）を引く。
 * Webhook処理前の数秒間は行が無いこともあるため、失敗しても null で続行する。
 */
async function fetchSerialNumber(sessionId: string): Promise<number | null> {
  try {
    const orders = await fetchWebOrders();
    const order = orders.find((row) => row.sessionId === sessionId);
    return order?.serialNumber ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 }
    );
  }

  try {
    const [session, serialNumber] = await Promise.all([
      stripe.checkout.sessions.retrieve(sessionId),
      fetchSerialNumber(sessionId),
    ]);

    return NextResponse.json({
      session_id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      customer_email:
        session.customer_details?.email ?? session.metadata?.customerEmail ?? "",
      serial_number: serialNumber,
    });
  } catch {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }
}
