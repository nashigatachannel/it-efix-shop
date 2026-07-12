import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { fetchWebOrders, type WebOrderRow } from "@/lib/sheets";

export const runtime = "nodejs";

export interface AccountOrderItem {
  orderId: string;
  orderedAt: string;
  model: string;
  amountTotal: number | null;
  paymentStatus: string;
  receiptUrl: string | null;
}

/**
 * 「Web注文」シートへの行書き込みは Stripe Webhook (/api/webhook) 経由のみ。
 * ローカル開発では `stripe listen --forward-to localhost:3000/api/webhook` を
 * 起動していないと注文行が一切書き込まれず、ここが空になるのは仕様。
 * 本番(Vercel)では Webhook が Stripe 側に登録済みのため対象外。
 */
function localDevWebhookHint(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return (
    "ローカル開発環境では、注文は Stripe Webhook が届いて初めて「Web注文」シートに書き込まれます。" +
    "別ターミナルで `stripe listen --forward-to localhost:3000/api/webhook` を起動した状態でテスト注文を完了させてください" +
    "(本番環境ではWebhookが登録済みのため、この操作は不要です)。"
  );
}

/**
 * Checkout Session から領収書URLを抽出する。
 * カード決済: charge.receipt_url / それ以外(銀行振込等): invoice.hosted_invoice_url にフォールバック。
 */
function extractReceiptUrl(session: Stripe.Checkout.Session): string | null {
  const paymentIntent = session.payment_intent;
  if (paymentIntent && typeof paymentIntent === "object") {
    const charge = paymentIntent.latest_charge;
    if (charge && typeof charge === "object" && charge.receipt_url) {
      return charge.receipt_url;
    }
  }
  const invoice = session.invoice;
  if (invoice && typeof invoice === "object" && invoice.hosted_invoice_url) {
    return invoice.hosted_invoice_url;
  }
  return null;
}

/**
 * Stripeからの領収書URL取得は失敗しても注文一覧自体は返す(nullで続行)。
 */
async function fetchReceiptUrl(sessionId: string): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge", "invoice"],
    });
    return extractReceiptUrl(session);
  } catch (err) {
    console.error(
      `Failed to fetch Stripe receipt for account order (session=${sessionId}):`,
      err,
    );
    return null;
  }
}

function toOrderItem(row: WebOrderRow, receiptUrl: string | null): AccountOrderItem {
  return {
    orderId:
      row.serialNumber !== null ? String(row.serialNumber) : row.sessionId,
    orderedAt: row.orderedAt,
    model: row.model,
    amountTotal: row.amountTotal,
    paymentStatus: row.paymentStatus,
    receiptUrl,
  };
}

export async function GET(): Promise<NextResponse> {
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

  // Clerkアカウントに確認済みメールアドレスが無い場合は空の履歴を返す(他人情報の混入防止)。
  if (!email) {
    return NextResponse.json({ orders: [], devHint: localDevWebhookHint() });
  }
  const normalizedEmail = email.trim().toLowerCase();

  let allOrders: WebOrderRow[];
  try {
    allOrders = await fetchWebOrders();
  } catch (err) {
    console.error("Failed to fetch web orders for account page:", err);
    return NextResponse.json(
      { error: "注文履歴の取得に失敗しました。" },
      { status: 502 },
    );
  }

  // ログイン中ユーザーのメールアドレスに一致する行だけを抽出する。他ユーザーの注文は一切含めない。
  const myOrders = allOrders.filter(
    (row) => row.customerEmail.trim().toLowerCase() === normalizedEmail,
  );

  const orders = await Promise.all(
    myOrders.map(async (row) => {
      const receiptUrl = await fetchReceiptUrl(row.sessionId);
      return toOrderItem(row, receiptUrl);
    }),
  );

  orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));

  return NextResponse.json({
    orders,
    devHint: orders.length === 0 ? localDevWebhookHint() : null,
  });
}
