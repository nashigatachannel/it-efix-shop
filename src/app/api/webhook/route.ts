import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { google } from "googleapis";
import {
  findInvoiceRow,
  normalizeInvNumber,
  recordCardPayment,
} from "@/lib/sales-sheet";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const SPREADSHEET_ID =
  process.env.GOOGLE_ORDERS_SPREADSHEET_ID ??
  process.env.GOOGLE_SPREADSHEET_ID ??
  "";
const WEB_ORDERS_SHEET = "Web注文";
const PENDING_MODELS_SHEET = "機種保留マスタ";
const INSTALLATION_RESERVATION_SHEET = "取付予約";

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

async function getNextSerialNumber(
  sheets: ReturnType<typeof google.sheets>
): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WEB_ORDERS_SHEET}!A2:A`,
  });
  const values = res.data.values ?? [];
  let maxSerial = 0;
  for (const row of values) {
    const parsed = Number(row[0]);
    if (Number.isFinite(parsed) && parsed > maxSerial) {
      maxSerial = parsed;
    }
  }
  return maxSerial + 1;
}

/**
 * 実際に使われた決済手段を charge から判定する。
 * session.payment_method_types は「選択肢の一覧」なので、card と customer_balance を
 * 併記している現行 Checkout ではカード決済でも「銀行振込」と誤記される。
 */
async function resolvePaymentMethodLabel(
  session: Stripe.Checkout.Session,
): Promise<string> {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge"] },
      );
      const charge = paymentIntent.latest_charge;
      const methodType =
        charge && typeof charge === "object"
          ? charge.payment_method_details?.type
          : undefined;
      if (methodType === "card") return "カード";
      if (methodType === "customer_balance") return "銀行振込";
      if (methodType) return methodType;
    } catch (err) {
      console.error(
        `Failed to resolve payment method for session ${session.id}:`,
        err,
      );
    }
  }
  // charge がまだ無い＝銀行振込の入金待ち（async フロー）
  if (session.payment_status === "unpaid") return "銀行振込";
  const types = session.payment_method_types ?? [];
  if (types.includes("card")) return "カード";
  return types.join(",") || "不明";
}

function paymentDueLabel(session: Stripe.Checkout.Session): string {
  // 銀行振込の場合は customer_balance.bank_transfer.payment_intent から振込期限が来るが、
  // Checkout Session 自体の expires_at をひとまず期限とする (24h以内に振込URL発行)。
  // 入金完了後にここはWebhook側で「入金済」表示に置き換わる。
  if (session.payment_status === "paid") {
    return "入金済";
  }
  if (session.expires_at) {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(session.expires_at * 1000)) + " まで";
  }
  return "";
}

function paymentStatusForEvent(
  session: Stripe.Checkout.Session,
  eventType: string,
): string {
  if (eventType === "checkout.session.async_payment_failed") {
    return "payment_failed";
  }
  if (eventType === "checkout.session.expired") {
    return "expired";
  }
  return session.payment_status ?? "";
}

function paymentNoteForEvent(
  session: Stripe.Checkout.Session,
  eventType: string,
): string {
  if (eventType === "checkout.session.async_payment_failed") {
    return "支払い失敗";
  }
  if (eventType === "checkout.session.expired") {
    return "期限切れ";
  }
  return paymentDueLabel(session);
}

function selfInstallLabel(metadata: Record<string, string>): string {
  if (metadata.selfInstall === "true") return "取付なし(自分で取付)";
  if (metadata.selfInstall === "false") return "取付サービス利用";
  return "";
}

function buildSheetRow(
  session: Stripe.Checkout.Session,
  serialNumber: number,
  eventType: string,
  paymentMethod: string,
): (string | number)[] {
  const metadata = session.metadata ?? {};
  const requestInvoice =
    metadata.requestInvoice === "true" || metadata.requestInvoice === "1";
  const isCustom = metadata.type === "custom_payment";

  // 通常注文は productIds、カスタム決済は description（明細サマリ）
  const modelDisplay = isCustom
    ? metadata.description ?? ""
    : metadata.productIds ?? "";

  return [
    serialNumber,
    "", // サブID（分割発注時に手入力）
    toJstDateString(new Date()),
    session.id,
    paymentStatusForEvent(session, eventType),
    paymentMethod,
    modelDisplay,
    session.amount_total ?? "",
    metadata.customerName ?? "",
    metadata.customerEmail ?? session.customer_email ?? "",
    metadata.customerPhone ?? "",
    metadata.customerPostalCode ?? "",
    metadata.customerAddress ?? "",
    metadata.machineMaker ?? "",
    metadata.machineModel ?? "",
    metadata.notes ?? "",
    requestInvoice ? "希望" : "",
    metadata.partnerId ?? "",
    paymentNoteForEvent(session, eventType),
    // V3 追加列(T〜Z)
    metadata.customerPrefecture ?? "",
    selfInstallLabel(metadata),
    metadata.desiredDate1 ?? "",
    metadata.desiredDate2 ?? "",
    metadata.desiredDate3 ?? "",
    "", // 取付完了日（管理画面で手動入力）
    "", // 返送伝票番号（管理画面で手動入力）
  ];
}

async function findWebOrderRowBySessionId(
  sheets: ReturnType<typeof google.sheets>,
  sessionId: string,
): Promise<{ rowNumber: number; values: unknown[] } | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WEB_ORDERS_SHEET}!A2:Z`,
  });
  const values = res.data.values ?? [];
  const index = values.findIndex(
    (row) => String(row[3] ?? "").trim() === sessionId,
  );
  if (index < 0) return null;
  return { rowNumber: index + 2, values: values[index] };
}

async function upsertWebOrder(
  sheets: ReturnType<typeof google.sheets>,
  session: Stripe.Checkout.Session,
  eventType: string,
): Promise<{ created: boolean; serialNumber: string | number }> {
  const existing = await findWebOrderRowBySessionId(sheets, session.id);
  const existingSerial = existing ? Number(existing.values[0]) : NaN;
  const serialNumber = Number.isFinite(existingSerial)
    ? existingSerial
    : await getNextSerialNumber(sheets);
  const paymentMethod = await resolvePaymentMethodLabel(session);
  const row = buildSheetRow(session, serialNumber, eventType, paymentMethod);

  if (existing) {
    const current = Array.from(
      { length: 26 },
      (_, index) => String(existing.values[index] ?? ""),
    );
    row[0] = current[0] || row[0];
    row[1] = current[1] || row[1];
    row[2] = current[2] || row[2];
    row[24] = current[24] || row[24];
    row[25] = current[25] || row[25];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${WEB_ORDERS_SHEET}!A${existing.rowNumber}:Z${existing.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    return { created: false, serialNumber: row[0] };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WEB_ORDERS_SHEET}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
  return { created: true, serialNumber };
}

async function upsertInstallationReservation(
  sheets: ReturnType<typeof google.sheets>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  if (metadata.selfInstall !== "false") return;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSTALLATION_RESERVATION_SHEET}!A2:A`,
    });
    const values = res.data.values ?? [];
    const alreadyExists = values.some(
      (row) => String(row[0] ?? "").trim() === session.id,
    );
    if (alreadyExists) return;

    const desiredDates = [
      metadata.desiredDate1,
      metadata.desiredDate2,
      metadata.desiredDate3,
    ]
      .map((value) => (value ?? "").trim())
      .filter(Boolean)
      .join(", ");
    const proposalHistory = desiredDates ? `希望: ${desiredDates}` : "";

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INSTALLATION_RESERVATION_SHEET}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            session.id,
            "requested",
            proposalHistory,
            "",
            "",
            "",
            "",
            "Webhook自動登録",
          ],
        ],
      },
    });
  } catch (err) {
    console.error("Failed to upsert installation reservation:", err);
  }
}

async function upsertPendingModel(
  sheets: ReturnType<typeof google.sheets>,
  maker: string,
  model: string,
  sessionId: string
): Promise<void> {
  const trimmedMaker = maker.trim();
  const trimmedModel = model.trim();
  if (!trimmedMaker && !trimmedModel) return;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PENDING_MODELS_SHEET}!A2:E`,
    });
    const values = res.data.values ?? [];
    const idx = values.findIndex(
      (row) => row[0] === trimmedMaker && row[1] === trimmedModel
    );
    if (idx >= 0) {
      const rowNumber = idx + 2;
      const existingCount = Number(values[idx][3]) || 0;
      const existingSessions = String(values[idx][4] ?? "");
      const sessionIds = existingSessions
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (sessionIds.includes(sessionId)) return;
      const newSessions = existingSessions
        ? `${existingSessions},${sessionId}`
        : sessionId;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_MODELS_SHEET}!D${rowNumber}:E${rowNumber}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[existingCount + 1, newSessions]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PENDING_MODELS_SHEET}!A:E`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              trimmedMaker,
              trimmedModel,
              toJstDateString(new Date()),
              1,
              sessionId,
            ],
          ],
        },
      });
    }
  } catch (err) {
    // 機種保留マスタの書き込み失敗は注文処理を止めない
    console.error("Failed to upsert pending model:", err);
  }
}

/**
 * 請求書カード払い(pay_type=invoice)の決済完了処理。
 * 現実世界で契約〜納品済みの売掛をカードで回収するルートで、Web注文/機種保留/取付予約とは無関係。
 * 一切実行しない: upsertWebOrder / upsertPendingModel / upsertInstallationReservation。
 */
async function handleInvoicePaymentCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = session.metadata ?? {};
  const invDisplayFromMetadata = metadata.inv_number ?? "";
  const serialFromMetadata = metadata.serial ?? "";
  const customerNameFromMetadata = metadata.customer_name ?? "";

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!paymentIntentId) {
    console.error(
      `Invoice payment session ${session.id} has no payment_intent; cannot record fee`,
    );
    return;
  }

  const invNumber = normalizeInvNumber(invDisplayFromMetadata);
  if (invNumber === null) {
    console.error(
      `Invoice payment session ${session.id} has invalid inv_number metadata: "${invDisplayFromMetadata}"`,
    );
    return;
  }

  const invoiceRow = await findInvoiceRow(invNumber);
  if (!invoiceRow) {
    console.error(
      `Invoice payment session ${session.id}: invoice row not found for INV-${invNumber}`,
    );
    return;
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = paymentIntent.latest_charge;
  const balanceTransaction =
    charge && typeof charge === "object" ? charge.balance_transaction : null;
  const feeJpy =
    balanceTransaction && typeof balanceTransaction === "object"
      ? balanceTransaction.fee
      : 0;

  const result = await recordCardPayment({
    rowIndex: invoiceRow.rowIndex,
    serial: serialFromMetadata || invoiceRow.serial,
    customerName: customerNameFromMetadata || invoiceRow.customerName,
    invDisplay: invoiceRow.invDisplay,
    amountJpy: invoiceRow.amountJpy,
    feeJpy,
    paymentIntentId,
    paidAtJst: new Date(),
  });

  if (result.alreadyRecordedForThisPayment) {
    console.log(
      `Invoice card payment already recorded (duplicate webhook delivery): session=${session.id} inv=${invoiceRow.invDisplay} row=${invoiceRow.rowIndex}`,
    );
    return;
  }

  console.log(
    `Invoice card payment recorded: session=${session.id} inv=${invoiceRow.invDisplay} row=${invoiceRow.rowIndex} gColumnAlreadyFilled=${result.gColumnAlreadyFilled}`,
  );
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
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    // 請求書カード払い(pay_type=invoice)は完全に別ルート。
    // Web注文/機種保留マスタ/取付予約への書き込みは一切行わない。
    if (session.metadata?.pay_type === "invoice") {
      if (event.type === "checkout.session.completed") {
        try {
          await handleInvoicePaymentCompleted(session);
        } catch (err) {
          console.error("Failed to record invoice card payment:", err);
        }
      } else {
        // カードのみのフローのため async_payment_*/expired は発生しない想定。ログのみ残す。
        console.log(
          `Ignoring invoice pay_type event (unexpected for card-only flow): session=${session.id} type=${event.type}`,
        );
      }
      return NextResponse.json({ received: true });
    }

    try {
      const sheets = await getGoogleSheetsClient();
      const result = await upsertWebOrder(sheets, session, event.type);
      console.log(
        `Order ${result.created ? "written" : "updated"} in Sheets: serial=${result.serialNumber} session=${session.id} status=${paymentStatusForEvent(session, event.type)} (${event.type})`
      );

      // 機種保留マスタへの蓄積(retail 注文のみ)
      const metadata = session.metadata ?? {};
      if (
        session.payment_status === "paid" &&
        (metadata.priceTier === "retail" || !metadata.priceTier)
      ) {
        await upsertPendingModel(
          sheets,
          metadata.machineMaker ?? "",
          metadata.machineModel ?? "",
          session.id
        );
        await upsertInstallationReservation(sheets, session);
      }
    } catch (err) {
      console.error("Failed to write to Google Sheets:", err);
    }
  }

  return NextResponse.json({ received: true });
}
