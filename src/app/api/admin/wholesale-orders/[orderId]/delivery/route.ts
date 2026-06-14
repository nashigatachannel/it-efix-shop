import { NextRequest, NextResponse } from "next/server";
import {
  getSheetsClient,
  sheetRange,
  WHOLESALE_ORDER_DETAILS_SHEET,
  WHOLESALE_ORDERS_SHEET,
  WHOLESALE_SPREADSHEET_ID,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface DeliveryRequestBody {
  delivered?: boolean;
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  let body: DeliveryRequestBody;
  try {
    body = (await request.json()) as DeliveryRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId ?? "").trim();
  if (!decodedOrderId) {
    return NextResponse.json(
      { error: "注文番号が指定されていません。" },
      { status: 400 },
    );
  }
  if (!WHOLESALE_SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "卸注文管理シートが設定されていません。" },
      { status: 500 },
    );
  }

  const delivered = Boolean(body.delivered);
  const deliveryStatus = delivered ? "納品済み" : "未納品";
  const updatedAt = nowJst();
  const sheets = getSheetsClient();

  const ordersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: WHOLESALE_SPREADSHEET_ID,
    range: sheetRange(WHOLESALE_ORDERS_SHEET, "A2:AA"),
  });
  const orders = ordersRes.data.values ?? [];
  const orderIndex = orders.findIndex(
    (row) => String(row[0] ?? "").trim() === decodedOrderId,
  );

  if (orderIndex < 0) {
    return NextResponse.json(
      { error: "対象の卸注文が見つかりません。" },
      { status: 404 },
    );
  }

  const order = orders[orderIndex];
  const orderStatus = String(order[2] ?? "").trim();
  if (orderStatus.includes("キャンセル") || orderStatus.includes("取消")) {
    return NextResponse.json(
      { error: "キャンセル済みの注文は納品状態を変更できません。" },
      { status: 409 },
    );
  }

  const detailsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: WHOLESALE_SPREADSHEET_ID,
    range: sheetRange(WHOLESALE_ORDER_DETAILS_SHEET, "A2:M"),
  });
  const details = detailsRes.data.values ?? [];
  const orderRowNumber = orderIndex + 2;
  const detailUpdates = details
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => String(row[0] ?? "").trim() === decodedOrderId)
    .map(({ rowNumber }) => ({
      range: sheetRange(WHOLESALE_ORDER_DETAILS_SHEET, `M${rowNumber}`),
      values: [[deliveryStatus]],
    }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: WHOLESALE_SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: sheetRange(WHOLESALE_ORDERS_SHEET, `T${orderRowNumber}:U${orderRowNumber}`),
          values: [[deliveryStatus, delivered ? updatedAt : ""]],
        },
        {
          range: sheetRange(WHOLESALE_ORDERS_SHEET, `AA${orderRowNumber}`),
          values: [[updatedAt]],
        },
        ...detailUpdates,
      ],
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: decodedOrderId,
    deliveryStatus,
    deliveredAt: delivered ? updatedAt : "",
    updatedAt,
  });
}
