import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchWebOrders, type WebOrderRow } from "@/lib/sheets";
import { webOrderDisplayId } from "@/lib/order-number";

export const runtime = "nodejs";

export interface AccountOrderItem {
  orderId: string;
  orderedAt: string;
  model: string;
  amountTotal: number | null;
  paymentStatus: string;
  customerName: string;
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

function toOrderItem(row: WebOrderRow): AccountOrderItem {
  return {
    orderId: webOrderDisplayId(row.serialNumber, row.sessionId),
    orderedAt: row.orderedAt,
    model: row.model,
    amountTotal: row.amountTotal,
    paymentStatus: row.paymentStatus,
    customerName: row.customerName,
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

  const orders = myOrders.map(toOrderItem);

  orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));

  return NextResponse.json({
    orders,
    devHint: orders.length === 0 ? localDevWebhookHint() : null,
  });
}
