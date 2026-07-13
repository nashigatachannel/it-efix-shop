import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { fetchWebOrders, type WebOrderRow } from "@/lib/sheets";
import {
  generateInvoicePdf,
  type InvoiceLineItem,
} from "@/lib/receipt-pdf";
import { webOrderDisplayId } from "@/lib/order-number";

export const runtime = "nodejs";

const MAX_ADDRESSEE_LENGTH = 60;

function toJstDateLabel(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

/** 「Web注文」シートの注文日時文字列から日付部分だけを取り出す。 */
function transactionDateLabel(orderedAt: string): string {
  const match = orderedAt.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return orderedAt || "—";
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
}

function findMyOrder(
  allOrders: WebOrderRow[],
  normalizedEmail: string,
  orderId: string,
): WebOrderRow | undefined {
  return allOrders.find((row) => {
    if (row.customerEmail.trim().toLowerCase() !== normalizedEmail) {
      return false;
    }
    return webOrderDisplayId(row.serialNumber, row.sessionId) === orderId;
  });
}

/**
 * Stripe の Checkout Session から明細行を取得する。
 * 取得できない場合はシートの機種名で1行のフォールバック明細を返す。
 */
async function fetchLineItems(order: WebOrderRow): Promise<InvoiceLineItem[]> {
  const fallback: InvoiceLineItem[] = [
    {
      description: order.model || "E-FIX製品",
      quantity: 1,
      unitAmount: order.amountTotal,
      amountTotal: order.amountTotal ?? 0,
    },
  ];
  if (!order.sessionId.startsWith("cs_")) return fallback;

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(
      order.sessionId,
      { limit: 100 },
    );
    if (lineItems.data.length === 0) return fallback;
    return lineItems.data.map((item) => ({
      description: item.description || "商品",
      quantity: item.quantity ?? 1,
      unitAmount: item.price?.unit_amount ?? null,
      amountTotal: item.amount_total,
    }));
  } catch (err) {
    console.error(
      `Failed to fetch line items for invoice (session=${order.sessionId}):`,
      err,
    );
    return fallback;
  }
}

/**
 * 実際に使われた決済手段を Stripe の charge から解決する。
 * シートの値は過去の誤記（カード決済が「銀行振込」）があり得るため信用しない。
 */
async function resolvePaymentMethodLabel(order: WebOrderRow): Promise<string> {
  if (!order.sessionId.startsWith("cs_")) {
    return order.paymentMethod || "—";
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(order.sessionId, {
      expand: ["payment_intent.latest_charge"],
    });
    const paymentIntent = session.payment_intent;
    const charge =
      paymentIntent && typeof paymentIntent === "object"
        ? (paymentIntent.latest_charge as Stripe.Charge | null)
        : null;
    const methodType =
      charge && typeof charge === "object"
        ? charge.payment_method_details?.type
        : undefined;
    if (methodType === "card") return "クレジットカード";
    if (methodType === "customer_balance") return "銀行振込";
    if (methodType) return methodType;
  } catch (err) {
    console.error(
      `Failed to resolve payment method for invoice (session=${order.sessionId}):`,
      err,
    );
  }
  return order.paymentMethod || "—";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses.find(
      (address) => address.verification?.status === "verified",
    )?.emailAddress ??
    "";
  if (!email) {
    return NextResponse.json({ error: "確認済みメールアドレスがありません。" }, {
      status: 403,
    });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const params = request.nextUrl.searchParams;
  const orderId = (params.get("orderId") ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId が必要です。" }, { status: 400 });
  }

  let allOrders: WebOrderRow[];
  try {
    allOrders = await fetchWebOrders();
  } catch (err) {
    console.error("Failed to fetch web orders for invoice:", err);
    return NextResponse.json(
      { error: "注文情報の取得に失敗しました。" },
      { status: 502 },
    );
  }

  // ログイン中ユーザー本人の注文のみ発行可（他人の注文番号を指定しても見つからない）。
  const order = findMyOrder(allOrders, normalizedEmail, orderId);
  if (!order) {
    return NextResponse.json({ error: "注文が見つかりません。" }, { status: 404 });
  }
  if (order.paymentStatus !== "paid") {
    return NextResponse.json(
      { error: "入金済みの注文のみ適格請求書を発行できます。" },
      { status: 409 },
    );
  }
  if (order.amountTotal === null || order.amountTotal <= 0) {
    return NextResponse.json(
      { error: "金額情報が無いため適格請求書を発行できません。" },
      { status: 409 },
    );
  }

  const addressee = (params.get("to") ?? "").trim() || order.customerName || "";
  if (!addressee) {
    return NextResponse.json({ error: "宛名を入力してください。" }, { status: 400 });
  }
  if (addressee.length > MAX_ADDRESSEE_LENGTH) {
    return NextResponse.json(
      { error: `宛名は${MAX_ADDRESSEE_LENGTH}文字以内で入力してください。` },
      { status: 400 },
    );
  }

  const [lineItems, paymentMethodLabel] = await Promise.all([
    fetchLineItems(order),
    resolvePaymentMethodLabel(order),
  ]);

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateInvoicePdf({
      documentNumber: `W-${orderId}`,
      addressee,
      lineItems,
      amountTotal: order.amountTotal,
      transactionDate: transactionDateLabel(order.orderedAt),
      paymentMethodLabel,
      issuedDate: toJstDateLabel(new Date()),
    });
  } catch (err) {
    console.error("Failed to generate invoice PDF:", err);
    return NextResponse.json(
      { error: "適格請求書の生成に失敗しました。" },
      { status: 500 },
    );
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${encodeURIComponent(orderId)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
