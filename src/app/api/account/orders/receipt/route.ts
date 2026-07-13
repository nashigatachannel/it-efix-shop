import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchWebOrders, type WebOrderRow } from "@/lib/sheets";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

export const runtime = "nodejs";

const MAX_ADDRESSEE_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 80;

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
    const rowOrderId =
      row.serialNumber !== null ? String(row.serialNumber) : row.sessionId;
    return rowOrderId === orderId;
  });
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
    console.error("Failed to fetch web orders for receipt:", err);
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
      { error: "入金済みの注文のみ領収書を発行できます。" },
      { status: 409 },
    );
  }
  if (order.amountTotal === null || order.amountTotal <= 0) {
    return NextResponse.json(
      { error: "金額情報が無いため領収書を発行できません。" },
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

  const description =
    (params.get("note") ?? "").trim() || `${order.model || "E-FIX製品"} 代金`;
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `但し書きは${MAX_DESCRIPTION_LENGTH}文字以内で入力してください。` },
      { status: 400 },
    );
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateReceiptPdf({
      receiptNumber: `R-${orderId}`,
      addressee,
      description,
      amountTotal: order.amountTotal,
      transactionDate: transactionDateLabel(order.orderedAt),
      paymentMethodLabel: order.paymentMethod || "—",
      issuedDate: toJstDateLabel(new Date()),
    });
  } catch (err) {
    console.error("Failed to generate receipt PDF:", err);
    return NextResponse.json(
      { error: "領収書の生成に失敗しました。" },
      { status: 500 },
    );
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${encodeURIComponent(orderId)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
