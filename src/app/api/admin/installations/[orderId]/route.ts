import { NextRequest, NextResponse } from "next/server";
import {
  getSheetsClient,
  INSTALLATION_RESERVATION_SHEET,
  sheetRange,
  SPREADSHEET_ID,
  WEB_ORDERS_SHEET,
  fetchInstallationReservations,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface UpdateRequestBody {
  status?: string;
  confirmedDate?: string;
  vendorId?: string;
  installedAt?: string;
  returnTrackingNumber?: string;
  notes?: string;
}

const ALLOWED_STATUSES = new Set([
  "requested",
  "proposing",
  "confirmed",
  "installed",
  "cancelled",
]);

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  let body: UpdateRequestBody;
  try {
    body = (await request.json()) as UpdateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId ?? "").trim();
  if (!decodedOrderId) {
    return NextResponse.json(
      { error: "注文IDが指定されていません。" },
      { status: 400 },
    );
  }
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "取付予約シートが設定されていません。" },
      { status: 500 },
    );
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: `不正なステータス: ${body.status}` },
      { status: 400 },
    );
  }

  const reservations = await fetchInstallationReservations();
  const target = reservations.find((row) => row.orderId === decodedOrderId);
  if (!target) {
    return NextResponse.json(
      { error: "対象の取付予約が見つかりません。" },
      { status: 404 },
    );
  }

  const next = {
    status: body.status ?? target.status,
    proposalHistory: target.proposalHistory,
    confirmedDate: body.confirmedDate ?? target.confirmedDate,
    vendorId: body.vendorId ?? target.vendorId,
    installedAt: body.installedAt ?? target.installedAt,
    returnTrackingNumber:
      body.returnTrackingNumber ?? target.returnTrackingNumber,
    notes: body.notes ?? target.notes,
  };

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(
      INSTALLATION_RESERVATION_SHEET,
      `B${target.rowNumber}:H${target.rowNumber}`,
    ),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          next.status,
          next.proposalHistory,
          next.confirmedDate,
          next.vendorId,
          next.installedAt,
          next.returnTrackingNumber,
          next.notes,
        ],
      ],
    },
  });

  // 取付完了/伝票番号は Web注文 シートの Y/Z 列にもミラー反映する。
  if (
    body.installedAt !== undefined ||
    body.returnTrackingNumber !== undefined
  ) {
    try {
      const webRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetRange(WEB_ORDERS_SHEET, "A2:Z"),
      });
      const rows = webRes.data.values ?? [];
      const idx = rows.findIndex(
        (row) => String(row[3] ?? "").trim() === decodedOrderId,
      );
      if (idx >= 0) {
        const rowNumber = idx + 2;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: sheetRange(WEB_ORDERS_SHEET, `Y${rowNumber}:Z${rowNumber}`),
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[next.installedAt, next.returnTrackingNumber]],
          },
        });
      }
    } catch (err) {
      console.error("Failed to mirror Web注文 Y/Z columns:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    orderId: decodedOrderId,
    updatedAt: nowJst(),
    next,
  });
}
