import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendHottaOrderEmail } from "@/lib/hotta-order";
import { fetchPartnerById, getCurrentPartner } from "@/lib/partner-auth";
import { getSheetsClient } from "@/lib/sheets";
import {
  formatYen,
  isGeneratedHottaBracketItem,
  isHottaBracketItem,
  wholesaleItemsForTier,
  type WholesaleCatalogItem,
} from "@/lib/wholesale-catalog";

export const dynamic = "force-dynamic";

const ORDERS_SHEET = process.env.GOOGLE_WHOLESALE_ORDERS_SHEET ?? "卸注文管理";
const DETAILS_SHEET =
  process.env.GOOGLE_WHOLESALE_ORDER_DETAILS_SHEET ?? "卸受注明細";
const DEFAULT_WHOLESALE_SPREADSHEET_ID =
  "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q";

const ORDER_HEADERS = [
  "受注番号",
  "受注日時",
  "受注ステータス",
  "価格区分",
  "販売店ID",
  "会社名",
  "担当者名",
  "メール",
  "電話番号",
  "郵便番号",
  "納品先住所",
  "商品明細",
  "小計(税抜)",
  "消費税",
  "合計(税込)",
  "希望納期",
  "支払条件",
  "備考",
  "参照元",
  "納品ステータス",
  "納品日",
  "請求ステータス",
  "請求月",
  "請求書番号",
  "請求送信予定日",
  "請求送信日時",
  "最終更新日",
];

const DETAIL_HEADERS = [
  "受注番号",
  "行No",
  "区分",
  "対応機種",
  "セクション",
  "カテゴリ",
  "品番",
  "商品名",
  "数量",
  "単価(税抜)",
  "小計(税抜)",
  "在庫引当ステータス",
  "納品ステータス",
];

interface CustomerInput {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  desiredDeliveryDate?: string;
  paymentTerms?: string;
  machineModel?: string;
  notes?: string;
}

interface RequestItem {
  id?: string;
  quantity?: number;
}

interface WholesaleOrderRequest {
  customer?: CustomerInput;
  items?: RequestItem[];
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

function orderId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `EFW-${yy}${mm}${dd}-${suffix}`;
}

function normalizeLine(raw: RequestItem, catalogItems: WholesaleCatalogItem[]): {
  item: WholesaleCatalogItem;
  quantity: number;
} | null {
  if (!raw.id) return null;
  const item = catalogItems.find((candidate) => candidate.id === raw.id);
  if (!item) return null;
  const quantity = Math.floor(Number(raw.quantity ?? 0));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) return null;
  return { item, quantity };
}

function spreadsheetId(): string {
  return (
    process.env.GOOGLE_WHOLESALE_SPREADSHEET_ID ??
    process.env.GOOGLE_ORDERS_SPREADSHEET_ID ??
    process.env.GOOGLE_SPREADSHEET_ID ??
    DEFAULT_WHOLESALE_SPREADSHEET_ID
  );
}

function sheetRange(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}

function columnName(index: number): string {
  let n = index;
  let name = "";
  while (n > 0) {
    n -= 1;
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26);
  }
  return name;
}

async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetIdValue: string,
  title: string,
  headers: string[],
) {
  const book = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetIdValue,
    fields: "sheets.properties.title",
  });
  const exists = (book.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === title,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetIdValue,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: Math.max(headers.length, 12),
                },
              },
            },
          },
        ],
      },
    });
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetIdValue,
    range: sheetRange(title, `A1:${columnName(headers.length)}1`),
  });
  if ((headerRes.data.values?.[0]?.length ?? 0) === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetIdValue,
      range: sheetRange(title, "A1"),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: WholesaleOrderRequest;
  try {
    body = (await request.json()) as WholesaleOrderRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const customer = body.customer ?? {};
  const session = await getCurrentPartner();
  if (!session) {
    return NextResponse.json(
      { error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const catalogItems = wholesaleItemsForTier(session.tier);
  const profile = await fetchPartnerById(session.partnerId);
  const companyName = profile?.companyName || session.companyName;
  const lines = (body.items ?? [])
    .map((line) => normalizeLine(line, catalogItems))
    .filter((line): line is { item: WholesaleCatalogItem; quantity: number } =>
      Boolean(line),
    );

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "数量1以上の商品が必要です。" },
      { status: 400 },
    );
  }
  if (
    !customer.email ||
    !customer.phone
  ) {
    return NextResponse.json(
      { error: "メール、電話番号は必須です。" },
      { status: 400 },
    );
  }
  const hiddenHottaKitLines = lines.filter((line) =>
    isGeneratedHottaBracketItem(line.item),
  );
  if (hiddenHottaKitLines.length > 0) {
    return NextResponse.json(
      {
        error:
          "堀田機工ブラケットはSTEP 3の4項目から選択してください。",
      },
      { status: 400 },
    );
  }

  const hottaLines = lines.filter((line) => isHottaBracketItem(line.item));
  if (hottaLines.length > 0 && !customer.machineModel?.trim()) {
    return NextResponse.json(
      { error: "堀田機工ブラケットを注文する場合は、取付機種が必要です。" },
      { status: 400 },
    );
  }
  if (!companyName) {
    return NextResponse.json(
      { error: "ログイン中の販売店名を確認できません。再ログインしてください。" },
      { status: 400 },
    );
  }

  const id = orderId();
  const subtotalExTax = lines.reduce(
    (sum, line) => sum + line.item.wholesalePriceExTax * line.quantity,
    0,
  );
  const tax = Math.round(subtotalExTax * 0.1);
  const totalIncTax = subtotalExTax + tax;
  const detailText = lines
    .map((line) => `${line.item.shortName} x${line.quantity}`)
    .join(" / ");
  const hasHottaLines = hottaLines.length > 0;
  const normalizedNotes = [
    customer.notes,
    customer.machineModel ? `取付機種: ${customer.machineModel}` : "",
    hasHottaLines ? "堀田機工ブラケット価格未定" : "",
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" / ");

  const spreadsheetIdValue = spreadsheetId();
  if (!spreadsheetIdValue || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json({
      ok: true,
      saved: false,
      orderId: id,
      message:
        "Google Sheets保存先が未設定です。CSV保存または環境変数 GOOGLE_WHOLESALE_SPREADSHEET_ID を設定してください。",
      subtotalExTax,
      tax,
      totalIncTax,
    });
  }

  try {
    const sheets = getSheetsClient();
    await ensureSheet(sheets, spreadsheetIdValue, ORDERS_SHEET, ORDER_HEADERS);
    await ensureSheet(sheets, spreadsheetIdValue, DETAILS_SHEET, DETAIL_HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetIdValue,
      range: sheetRange(ORDERS_SHEET, "A:AA"),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            id,
            nowJst(),
            "受付",
            session.tier === "distributor" ? "特価卸" : "通常卸",
            session.partnerId,
            companyName,
            customer.contactName,
            customer.email,
            customer.phone,
            customer.postalCode ?? "",
            customer.address ?? "",
            detailText,
            subtotalExTax,
            tax,
            totalIncTax,
            customer.desiredDeliveryDate ?? "",
            customer.paymentTerms ?? "",
            normalizedNotes,
            session.tier === "distributor"
              ? "special-wholesale-site"
              : "wholesale-site",
            "未納品",
            "",
            hasHottaLines ? "価格確認中" : "未請求",
            "",
            "",
            "",
            "",
            nowJst(),
          ],
        ],
      },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetIdValue,
      range: sheetRange(DETAILS_SHEET, "A:M"),
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: lines.map((line, index) => [
          id,
          index + 1,
          line.item.kind === "set" ? "本体セット" : "部品・オプション",
          line.item.model,
          line.item.section,
          line.item.category,
          line.item.partNumber,
          line.item.name,
          line.quantity,
          isHottaBracketItem(line.item) ? "" : line.item.wholesalePriceExTax,
          isHottaBracketItem(line.item)
            ? ""
            : line.item.wholesalePriceExTax * line.quantity,
          "未引当",
          "未納品",
        ]),
      },
    });

    let hottaMessage = "";
    let hottaOrderSent = false;
    let hottaOrderSkipped = false;
    if (hasHottaLines) {
      const hottaResult = await sendHottaOrderEmail({
        orderId: id,
        customer: {
          companyName,
          contactName: customer.contactName,
          email: customer.email,
          phone: customer.phone,
          postalCode: customer.postalCode,
          address: customer.address,
          desiredDeliveryDate: customer.desiredDeliveryDate,
          machineModel: customer.machineModel,
          notes: customer.notes,
        },
        lines: hottaLines,
      });
      hottaOrderSent = hottaResult.sent;
      hottaOrderSkipped = Boolean(hottaResult.skippedReason);
      if (hottaResult.sent) {
        hottaMessage = "堀田機工へ注文書メールを送信しました。";
      } else if (hottaResult.skippedReason) {
        hottaMessage = `堀田機工メールは未送信です: ${hottaResult.skippedReason}`;
      } else if (hottaResult.error) {
        hottaMessage = `堀田機工メール送信に失敗しました: ${hottaResult.error}`;
      }
    }

    return NextResponse.json({
      ok: true,
      saved: true,
      orderId: id,
      message: [
        `受注管理表へ保存しました。合計 ${formatYen(totalIncTax)}`,
        hottaMessage,
      ]
        .filter(Boolean)
        .join(" "),
      hottaOrderSent,
      hottaOrderSkipped,
      subtotalExTax,
      tax,
      totalIncTax,
    });
  } catch (error) {
    console.error("Failed to save wholesale order", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "受注管理表への保存に失敗しました。",
      },
      { status: 500 },
    );
  }
}
