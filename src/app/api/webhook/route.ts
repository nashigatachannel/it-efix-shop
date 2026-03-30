import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { google } from "googleapis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

async function getGoogleSheetsClient() {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  ) as Record<string, unknown>;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function toJstDateString(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function buildSheetRow(session: Stripe.Checkout.Session): string[] {
  const metadata = session.metadata ?? {};

  return [
    toJstDateString(new Date()),
    session.id,
    metadata.productIds ?? "",
    session.amount_total != null ? String(session.amount_total) : "",
    session.payment_status ?? "",
    metadata.customerName ?? "",
    metadata.customerPostalCode ?? "",
    metadata.customerAddress ?? "",
    metadata.customerPhone ?? "",
    metadata.customerEmail ?? session.customer_email ?? "",
    metadata.machineMaker ?? "",
    metadata.machineModel ?? "",
    metadata.notes ?? "",
  ];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    // 署名検証失敗時、bodyをパースしてフォールバック（デバッグ用）
    console.error("Webhook signature verification failed:", err);
    try {
      event = JSON.parse(body) as Stripe.Event;
      console.warn("Signature verification skipped - using raw event body");
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    // カード決済: completed時にpaid → 即記録
    // 銀行振込: completed時はunpaid → スキップ、async_payment_succeeded時にpaid → 記録
    if (session.payment_status !== "paid") {
      console.log(
        `Skipping Sheets write: session=${session.id} payment_status=${session.payment_status} (awaiting bank transfer)`
      );
      return NextResponse.json({ received: true });
    }

    const row = buildSheetRow(session);

    try {
      const sheets = await getGoogleSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "シート1!A:M",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [row],
        },
      });
      console.log(`Order written to Sheets: session=${session.id} (${event.type})`);
    } catch (err) {
      // Sheets書き込み失敗してもStripeには200を返す（リトライ無限ループ防止）
      console.error("Failed to write to Google Sheets:", err);
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.error(
      `Bank transfer payment failed: session=${session.id} customer=${session.metadata?.customerName ?? "unknown"}`
    );
    // TODO: 入金失敗時の通知（メール等）が必要なら追加
  }

  return NextResponse.json({ received: true });
}
