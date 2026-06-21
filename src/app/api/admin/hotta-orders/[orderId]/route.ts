import { NextRequest, NextResponse } from "next/server";
import {
  getSheetsClient,
  isHottaWholesaleDetail,
  sheetRange,
  WHOLESALE_ORDER_DETAILS_SHEET,
  WHOLESALE_ORDERS_SHEET,
  WHOLESALE_SPREADSHEET_ID,
  type WholesaleOrderDetailRow,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

const BILLING_STATUSES = new Set([
  "価格確認中",
  "未請求",
  "請求済み",
  "入金済み",
  "キャンセル",
]);

interface HottaDetailUpdateInput {
  lineNo?: number;
  quantity?: number;
  unitPriceExTax?: number | null;
}

interface HottaOrderUpdateBody {
  machineModel?: string;
  notes?: string;
  billingStatus?: string;
  details?: HottaDetailUpdateInput[];
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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseWholesaleDetailRow(row: unknown[]): WholesaleOrderDetailRow {
  return {
    orderId: String(row[0] ?? ""),
    lineNo: toNumberOrNull(row[1]),
    kind: String(row[2] ?? ""),
    model: String(row[3] ?? ""),
    section: String(row[4] ?? ""),
    category: String(row[5] ?? ""),
    partNumber: String(row[6] ?? ""),
    productName: String(row[7] ?? ""),
    quantity: toNumberOrNull(row[8]),
    unitPriceExTax: toNumberOrNull(row[9]),
    subtotalExTax: toNumberOrNull(row[10]),
    stockAllocationStatus: String(row[11] ?? ""),
    deliveryStatus: String(row[12] ?? ""),
  };
}

function normalizeInteger(
  value: unknown,
  fieldName: string,
  max: number,
): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${fieldName}は数値で入力してください。`);
  }
  const integer = Math.floor(number);
  if (integer < 0 || integer > max) {
    throw new Error(`${fieldName}は0〜${max}で入力してください。`);
  }
  return integer;
}

function normalizePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return normalizeInteger(value, "税抜単価", 9_999_999);
}

function normalizeNotes(machineModel: string, notes: string): string {
  return [
    notes,
    machineModel ? `取付機種: ${machineModel}` : "",
    "堀田機工ブラケット価格未定",
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" / ");
}

function buildDetailText(rows: unknown[][]): string {
  return rows
    .map((row) => {
      const productName = String(row[7] ?? "").trim();
      const quantity = toNumberOrNull(row[8]) ?? 0;
      return productName ? `${productName} x${quantity}` : "";
    })
    .filter(Boolean)
    .join(" / ");
}

function calculateSubtotal(rows: unknown[][]): number {
  return rows.reduce((sum, row) => {
    const explicitSubtotal = toNumberOrNull(row[10]);
    if (explicitSubtotal !== null) return sum + explicitSubtotal;

    const quantity = toNumberOrNull(row[8]);
    const unitPrice = toNumberOrNull(row[9]);
    if (quantity === null || unitPrice === null) return sum;
    return sum + quantity * unitPrice;
  }, 0);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  let body: HottaOrderUpdateBody;
  try {
    body = (await request.json()) as HottaOrderUpdateBody;
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
  if (!Array.isArray(body.details) || body.details.length === 0) {
    return NextResponse.json(
      { error: "更新する堀田機工明細がありません。" },
      { status: 400 },
    );
  }

  const machineModel = String(body.machineModel ?? "").trim().slice(0, 120);
  const notes = String(body.notes ?? "").trim().slice(0, 1000);
  const billingStatus = String(body.billingStatus ?? "").trim();
  if (billingStatus && !BILLING_STATUSES.has(billingStatus)) {
    return NextResponse.json(
      { error: "請求ステータスの値が不正です。" },
      { status: 400 },
    );
  }

  try {
    const requestedUpdates = new Map<
      number,
      { quantity: number; unitPriceExTax: number | null }
    >();
    for (const detail of body.details) {
      const lineNo = normalizeInteger(detail.lineNo, "行No", 999);
      requestedUpdates.set(lineNo, {
        quantity: normalizeInteger(detail.quantity, "数量", 999),
        unitPriceExTax: normalizePrice(detail.unitPriceExTax),
      });
    }

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

    const detailsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: WHOLESALE_SPREADSHEET_ID,
      range: sheetRange(WHOLESALE_ORDER_DETAILS_SHEET, "A2:M"),
    });
    const details = detailsRes.data.values ?? [];
    const indexedOrderDetails = details
      .map((row, index) => ({
        row: [...row],
        rowNumber: index + 2,
        parsed: parseWholesaleDetailRow(row),
      }))
      .filter(({ parsed }) => parsed.orderId === decodedOrderId);

    const hottaDetails = indexedOrderDetails.filter(({ parsed }) =>
      isHottaWholesaleDetail(parsed),
    );
    if (hottaDetails.length === 0) {
      return NextResponse.json(
        { error: "堀田機工の明細が見つかりません。" },
        { status: 404 },
      );
    }

    for (const lineNo of requestedUpdates.keys()) {
      const exists = hottaDetails.some(({ parsed }) => parsed.lineNo === lineNo);
      if (!exists) {
        return NextResponse.json(
          { error: `堀田機工明細の行No ${lineNo} が見つかりません。` },
          { status: 400 },
        );
      }
    }

    const detailUpdates = hottaDetails
      .map(({ parsed, row, rowNumber }) => {
        if (parsed.lineNo === null) return null;
        const update = requestedUpdates.get(parsed.lineNo);
        if (!update) return null;
        const subtotal =
          update.unitPriceExTax === null
            ? ""
            : update.quantity * update.unitPriceExTax;

        row[8] = update.quantity;
        row[9] = update.unitPriceExTax ?? "";
        row[10] = subtotal;

        return {
          row,
          rowNumber,
          values: [[update.quantity, update.unitPriceExTax ?? "", subtotal]],
        };
      })
      .filter(
        (
          update,
        ): update is {
          row: unknown[];
          rowNumber: number;
          values: (string | number)[][];
        } => Boolean(update),
      );

    const updatedRowsByLineNo = new Map(
      detailUpdates
        .map((update) => {
          const lineNo = toNumberOrNull(update.row[1]);
          return lineNo === null ? null : ([lineNo, update.row] as const);
        })
        .filter(
          (entry): entry is readonly [number, unknown[]] => entry !== null,
        ),
    );
    const updatedOrderDetailRows = indexedOrderDetails.map(({ parsed, row }) => {
      if (parsed.lineNo === null) return row;
      return updatedRowsByLineNo.get(parsed.lineNo) ?? row;
    });
    const subtotalExTax = calculateSubtotal(updatedOrderDetailRows);
    const tax = Math.round(subtotalExTax * 0.1);
    const totalIncTax = subtotalExTax + tax;
    const detailText = buildDetailText(updatedOrderDetailRows);
    const updatedAt = nowJst();
    const orderRowNumber = orderIndex + 2;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: WHOLESALE_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          ...detailUpdates.map((update) => ({
            range: sheetRange(
              WHOLESALE_ORDER_DETAILS_SHEET,
              `I${update.rowNumber}:K${update.rowNumber}`,
            ),
            values: update.values,
          })),
          {
            range: sheetRange(
              WHOLESALE_ORDERS_SHEET,
              `L${orderRowNumber}:O${orderRowNumber}`,
            ),
            values: [[detailText, subtotalExTax, tax, totalIncTax]],
          },
          {
            range: sheetRange(WHOLESALE_ORDERS_SHEET, `R${orderRowNumber}`),
            values: [[normalizeNotes(machineModel, notes)]],
          },
          ...(billingStatus
            ? [
                {
                  range: sheetRange(
                    WHOLESALE_ORDERS_SHEET,
                    `V${orderRowNumber}`,
                  ),
                  values: [[billingStatus]],
                },
              ]
            : []),
          {
            range: sheetRange(WHOLESALE_ORDERS_SHEET, `AA${orderRowNumber}`),
            values: [[updatedAt]],
          },
        ],
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: decodedOrderId,
      subtotalExTax,
      tax,
      totalIncTax,
      updatedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "堀田機工注文履歴の更新に失敗しました。",
      },
      { status: 500 },
    );
  }
}
