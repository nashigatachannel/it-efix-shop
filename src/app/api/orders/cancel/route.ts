import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSheetsClient, SPREADSHEET_ID, WEB_ORDERS_SHEET } from "@/lib/sheets";
import { fromDisplayOrderNumber } from "@/lib/order-number";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const CANCEL_WINDOW_MS = 60 * 60 * 1000;

interface CancelRequestBody {
  serialNumber?: string;
  sessionId?: string;
  emailOrPhone?: string;
}

function sheetRange(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}

function parseOrderDate(value: string): Date | null {
  const match = value.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/,
  );
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(
      2,
      "0",
    )}:${minute}:${second}+09:00`,
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]/g, "");
}

function paymentIntentId(
  session: Stripe.Checkout.Session,
): string | null {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: CancelRequestBody;
  try {
    body = (await request.json()) as CancelRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const serialNumber = String(body.serialNumber ?? "").trim();
  const sessionId = String(body.sessionId ?? "").trim();
  const emailOrPhone = normalize(String(body.emailOrPhone ?? ""));

  if (!sessionId && (!serialNumber || !emailOrPhone)) {
    return NextResponse.json(
      { error: "注文番号とメール/電話番号、またはセッションIDを入力してください。" },
      { status: 400 },
    );
  }
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "注文管理シートが設定されていません。" },
      { status: 500 },
    );
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(WEB_ORDERS_SHEET, "A2:S"),
  });
  const rows = res.data.values ?? [];
  // 顧客が入力するのは5桁の表示用注文番号。復号した通し番号と、
  // 旧形式(生の通し番号)の両方をA列と突合できるようにしておく。
  const decodedSerial = fromDisplayOrderNumber(serialNumber);
  const index = rows.findIndex((row) => {
    const rowSerial = String(row[0] ?? "").trim();
    const rowSessionId = String(row[3] ?? "").trim();
    const rowEmail = normalize(String(row[9] ?? ""));
    const rowPhone = normalize(String(row[10] ?? ""));
    if (sessionId) return rowSessionId === sessionId;
    const serialMatches =
      rowSerial === serialNumber ||
      (decodedSerial !== null && rowSerial === String(decodedSerial));
    return (
      serialMatches && (rowEmail === emailOrPhone || rowPhone === emailOrPhone)
    );
  });

  if (index < 0) {
    return NextResponse.json(
      { error: "キャンセル対象の注文が見つかりません。" },
      { status: 404 },
    );
  }

  const row = rows[index];
  const currentStatus = String(row[4] ?? "").trim();
  if (currentStatus.includes("cancel") || currentStatus.includes("キャンセル")) {
    return NextResponse.json({
      ok: true,
      message: "この注文はすでにキャンセル済みです。",
    });
  }

  const orderedAt = parseOrderDate(String(row[2] ?? ""));
  if (!orderedAt) {
    return NextResponse.json(
      { error: "注文日時を確認できないためキャンセルできません。" },
      { status: 400 },
    );
  }
  if (Date.now() - orderedAt.getTime() > CANCEL_WINDOW_MS) {
    return NextResponse.json(
      { error: "注文から1時間を過ぎているため、画面からはキャンセルできません。" },
      { status: 409 },
    );
  }

  const rowSessionId = String(row[3] ?? "").trim();
  if (!rowSessionId) {
    return NextResponse.json(
      { error: "決済セッションを確認できないためキャンセルできません。" },
      { status: 400 },
    );
  }

  const session = await stripe.checkout.sessions.retrieve(rowSessionId, {
    expand: ["payment_intent"],
  });

  let refundId = "";
  let cancelNote = "キャンセル済み";
  const intentId = paymentIntentId(session);
  if (session.payment_status === "paid" && intentId) {
    const refund = await stripe.refunds.create(
      {
        payment_intent: intentId,
        reason: "requested_by_customer",
        metadata: {
          orderSerial: String(row[0] ?? ""),
          checkoutSessionId: rowSessionId,
          source: "customer_cancel_page",
        },
      },
      { idempotencyKey: `cancel-order-${rowSessionId}` },
    );
    refundId = refund.id;
    cancelNote = `返金処理: ${refundId}`;
  } else if (session.status === "open") {
    await stripe.checkout.sessions.expire(rowSessionId);
    cancelNote = "Stripe Session期限切れ";
  } else if (intentId) {
    try {
      await stripe.paymentIntents.cancel(intentId, {
        cancellation_reason: "requested_by_customer",
      });
      cancelNote = "Stripe PaymentIntentキャンセル";
    } catch (err) {
      console.error("Failed to cancel unpaid Stripe payment:", err);
      return NextResponse.json(
        {
          error:
            "Stripe側の未入金決済をキャンセルできませんでした。管理者に連絡してください。",
        },
        { status: 502 },
      );
    }
  }

  const rowNumber = index + 2;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: sheetRange(WEB_ORDERS_SHEET, `E${rowNumber}`),
          values: [["canceled"]],
        },
        {
          range: sheetRange(WEB_ORDERS_SHEET, `S${rowNumber}`),
          values: [[cancelNote]],
        },
      ],
    },
  });

  return NextResponse.json({
    ok: true,
    refundId,
    message: refundId
      ? "注文をキャンセルし、返金処理を開始しました。"
      : "注文をキャンセルしました。",
  });
}
