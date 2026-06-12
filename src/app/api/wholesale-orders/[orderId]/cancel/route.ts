import { NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/partner-auth";
import { getSheetsClient } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const ORDERS_SHEET = process.env.GOOGLE_WHOLESALE_ORDERS_SHEET ?? "卸注文管理";
const DEFAULT_WHOLESALE_SPREADSHEET_ID =
  "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q";
const CANCEL_WINDOW_MS = 60 * 60 * 1000;

function spreadsheetId(): string {
  return (
    process.env.GOOGLE_WHOLESALE_SPREADSHEET_ID ??
    process.env.GOOGLE_SPREADSHEET_ID ??
    DEFAULT_WHOLESALE_SPREADSHEET_ID
  );
}

function sheetRange(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}

function nowJst(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
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

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const session = await getCurrentPartner();
  if (!session) {
    return NextResponse.json(
      { error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId ?? "").trim();
  if (!decodedOrderId) {
    return NextResponse.json(
      { error: "注文番号が指定されていません。" },
      { status: 400 },
    );
  }

  const spreadsheetIdValue = spreadsheetId();
  if (!spreadsheetIdValue || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "注文管理シートが設定されていません。" },
      { status: 500 },
    );
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetIdValue,
    range: sheetRange(ORDERS_SHEET, "A2:AA"),
  });
  const rows = res.data.values ?? [];
  const index = rows.findIndex(
    (row) =>
      String(row[0] ?? "").trim() === decodedOrderId &&
      String(row[4] ?? "").trim() === session.partnerId,
  );

  if (index < 0) {
    return NextResponse.json(
      { error: "キャンセル対象の注文が見つかりません。" },
      { status: 404 },
    );
  }

  const row = rows[index];
  const currentStatus = String(row[2] ?? "").trim();
  if (currentStatus.includes("キャンセル") || currentStatus.includes("取消")) {
    return NextResponse.json({
      ok: true,
      orderId: decodedOrderId,
      message: "この注文はすでにキャンセル済みです。",
    });
  }

  const orderedAt = parseOrderDate(String(row[1] ?? ""));
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

  const rowNumber = index + 2;
  const canceledAt = nowJst();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetIdValue,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: sheetRange(ORDERS_SHEET, `C${rowNumber}`),
          values: [["キャンセル済み"]],
        },
        {
          range: sheetRange(ORDERS_SHEET, `T${rowNumber}`),
          values: [["キャンセル"]],
        },
        {
          range: sheetRange(ORDERS_SHEET, `AA${rowNumber}`),
          values: [[canceledAt]],
        },
      ],
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: decodedOrderId,
    canceledAt,
    message: `注文 ${decodedOrderId} をキャンセルしました。`,
  });
}
