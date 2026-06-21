import { NextRequest, NextResponse } from "next/server";
import {
  fetchInventoryMaster,
  getSheetsClient,
  INVENTORY_MASTER_SHEET,
  sheetRange,
  SPREADSHEET_ID,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface UpdateRequestBody {
  currentStock?: number;
  salesLimit?: number;
  notes?: string;
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  let body: UpdateRequestBody;
  try {
    body = (await request.json()) as UpdateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { productId } = await context.params;
  const decodedProductId = decodeURIComponent(productId ?? "").trim();
  if (!decodedProductId) {
    return NextResponse.json(
      { error: "商品IDが指定されていません。" },
      { status: 400 },
    );
  }
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "在庫マスタシートが設定されていません。" },
      { status: 500 },
    );
  }

  if (body.currentStock !== undefined && body.currentStock < 0) {
    return NextResponse.json(
      { error: "在庫数は0以上の整数を指定してください。" },
      { status: 400 },
    );
  }
  if (body.salesLimit !== undefined && body.salesLimit < 0) {
    return NextResponse.json(
      { error: "販売上限は0以上の整数を指定してください。" },
      { status: 400 },
    );
  }

  const master = await fetchInventoryMaster();
  const existing = master.find((row) => row.productId === decodedProductId);
  const sheets = getSheetsClient();
  const timestamp = nowJst();

  const nextValues = {
    currentStock:
      body.currentStock ?? existing?.currentStock ?? 0,
    salesLimit: body.salesLimit ?? existing?.salesLimit ?? 0,
    notes: body.notes ?? existing?.notes ?? "",
  };

  if (existing) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetRange(
        INVENTORY_MASTER_SHEET,
        `B${existing.rowNumber}:E${existing.rowNumber}`,
      ),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            nextValues.currentStock,
            nextValues.salesLimit,
            timestamp,
            nextValues.notes,
          ],
        ],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetRange(INVENTORY_MASTER_SHEET, "A:E"),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            decodedProductId,
            nextValues.currentStock,
            nextValues.salesLimit,
            timestamp,
            nextValues.notes,
          ],
        ],
      },
    });
  }

  return NextResponse.json({
    ok: true,
    productId: decodedProductId,
    updatedAt: timestamp,
    next: nextValues,
  });
}
