import type { sheets_v4 } from "googleapis";
import {
  DONATION_PRODUCTS,
  MAIN_PRODUCTS,
  OPTION_PRODUCTS,
  TAX_RATE,
  calcTaxIncluded,
  type Product,
  type ProductId,
} from "@/lib/products";
import { getSheetsClient, sheetRange, SPREADSHEET_ID } from "@/lib/sheets";

export const WEB_CATALOG_SHEET = "Web販売商品マスタ";

export type WebCatalogStatus = "販売中" | "停止中" | "在庫切れ";

export interface WebCatalogItem {
  productId: ProductId;
  productName: string;
  sku: string;
  category: string;
  priceIncTax: number;
  stockQuantity: number | null;
  salesLimit: number | null;
  status: WebCatalogStatus;
  stopWhenOutOfStock: boolean;
  stripeProductId: string;
  stripePriceId: string;
  displayOrder: number;
  updatedAt: string;
  memo: string;
}

export interface WebCatalogLoadResult {
  items: WebCatalogItem[];
  spreadsheetId: string;
  sheetName: string;
  connected: boolean;
  seeded: boolean;
  error: string | null;
}

export type WebOrderProductGroups = {
  mainProducts: Product[];
  optionProducts: Product[];
  donationProducts: Product[];
};

const HEADERS = [
  "商品ID",
  "商品名",
  "SKU",
  "分類",
  "Web販売価格（税込）",
  "在庫数",
  "販売上限数",
  "販売ステータス",
  "在庫切れ時販売停止",
  "Stripe商品ID",
  "Stripe価格ID",
  "表示順",
  "更新日時",
  "メモ",
];

const BASE_PRODUCTS = [
  ...MAIN_PRODUCTS.map((product, index) => ({
    product,
    category: "本体",
    displayOrder: index + 10,
  })),
  ...OPTION_PRODUCTS.map((product, index) => ({
    product,
    category: "オプション",
    displayOrder: index + 100,
  })),
  ...DONATION_PRODUCTS.map((product, index) => ({
    product,
    category: "支援・寄付",
    displayOrder: index + 900,
  })),
];

const BASE_PRODUCT_IDS = new Set<ProductId>(
  BASE_PRODUCTS.map(({ product }) => product.id),
);

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

function defaultSku(productId: ProductId): string {
  return productId.toUpperCase().replace(/-/g, "_");
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/[¥,\s]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.floor(number) : null;
}

function normalizeBoolean(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y", "on", "有効", "する"].includes(
    normalized,
  );
}

function normalizeStatus(value: unknown): WebCatalogStatus {
  const normalized = String(value ?? "").trim();
  if (normalized === "停止中") return "停止中";
  if (normalized === "在庫切れ") return "在庫切れ";
  return "販売中";
}

function priceExTaxFromIncTax(priceIncTax: number): number {
  return Math.ceil(priceIncTax / (1 + TAX_RATE));
}

function defaultCatalogItem(
  product: Product,
  category: string,
  displayOrder: number,
): WebCatalogItem {
  return {
    productId: product.id,
    productName: product.name,
    sku: defaultSku(product.id),
    category,
    priceIncTax: calcTaxIncluded(product.priceExTax),
    stockQuantity: null,
    salesLimit: null,
    status: "販売中",
    stopWhenOutOfStock: true,
    stripeProductId: "",
    stripePriceId: "",
    displayOrder,
    updatedAt: "",
    memo: "",
  };
}

function defaultCatalogItems(): WebCatalogItem[] {
  return BASE_PRODUCTS.map(({ product, category, displayOrder }) =>
    defaultCatalogItem(product, category, displayOrder),
  );
}

function validateProductId(value: unknown): ProductId | null {
  const productId = String(value ?? "").trim() as ProductId;
  return BASE_PRODUCT_IDS.has(productId) ? productId : null;
}

function itemToRow(item: WebCatalogItem): string[] {
  return [
    item.productId,
    item.productName,
    item.sku,
    item.category,
    String(item.priceIncTax),
    item.stockQuantity === null ? "" : String(item.stockQuantity),
    item.salesLimit === null ? "" : String(item.salesLimit),
    item.status,
    item.stopWhenOutOfStock ? "TRUE" : "FALSE",
    item.stripeProductId,
    item.stripePriceId,
    String(item.displayOrder),
    item.updatedAt,
    item.memo,
  ];
}

function rowToItem(row: unknown[]): WebCatalogItem | null {
  const productId = validateProductId(row[0]);
  if (!productId) return null;
  const fallback = defaultCatalogItems().find(
    (item) => item.productId === productId,
  );
  if (!fallback) return null;

  return {
    ...fallback,
    productName: String(row[1] ?? fallback.productName).trim() || fallback.productName,
    sku: String(row[2] ?? fallback.sku).trim() || fallback.sku,
    category: String(row[3] ?? fallback.category).trim() || fallback.category,
    priceIncTax: normalizeNumber(row[4]) ?? fallback.priceIncTax,
    stockQuantity: normalizeNumber(row[5]),
    salesLimit: normalizeNumber(row[6]),
    status: normalizeStatus(row[7]),
    stopWhenOutOfStock: row[8] === "" ? fallback.stopWhenOutOfStock : normalizeBoolean(row[8]),
    stripeProductId: String(row[9] ?? "").trim(),
    stripePriceId: String(row[10] ?? "").trim(),
    displayOrder: normalizeNumber(row[11]) ?? fallback.displayOrder,
    updatedAt: String(row[12] ?? "").trim(),
    memo: String(row[13] ?? "").trim(),
  };
}

function mergeWithDefaults(sheetItems: WebCatalogItem[]): WebCatalogItem[] {
  const byId = new Map<ProductId, WebCatalogItem>();
  for (const item of defaultCatalogItems()) byId.set(item.productId, item);
  for (const item of sheetItems) byId.set(item.productId, item);
  return Array.from(byId.values()).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

async function ensureWebCatalogSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<void> {
  const book = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (book.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === WEB_CATALOG_SHEET,
  );
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: WEB_CATALOG_SHEET } } }],
      },
    });
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(WEB_CATALOG_SHEET, "A1:N1"),
  });
  const currentHeader = headerRes.data.values?.[0] ?? [];
  if (currentHeader.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange(WEB_CATALOG_SHEET, "A1:N1"),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
  }
}

export async function fetchWebCatalogItems(
  options: { seedIfEmpty?: boolean } = {},
): Promise<WebCatalogLoadResult> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return {
      items: defaultCatalogItems(),
      spreadsheetId: SPREADSHEET_ID,
      sheetName: WEB_CATALOG_SHEET,
      connected: false,
      seeded: false,
      error: "GOOGLE_ORDERS_SPREADSHEET_ID または GOOGLE_SERVICE_ACCOUNT_KEY が未設定です",
    };
  }

  try {
    const sheets = getSheetsClient();
    if (options.seedIfEmpty) {
      await ensureWebCatalogSheet(sheets, SPREADSHEET_ID);
    }
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetRange(WEB_CATALOG_SHEET, "A2:N"),
    });
    const rows = res.data.values ?? [];

    if (rows.length === 0) {
      if (!options.seedIfEmpty) {
        return {
          items: defaultCatalogItems(),
          spreadsheetId: SPREADSHEET_ID,
          sheetName: WEB_CATALOG_SHEET,
          connected: true,
          seeded: false,
          error: null,
        };
      }
      const seededItems = defaultCatalogItems().map((item) => ({
        ...item,
        updatedAt: nowJst(),
      }));
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetRange(WEB_CATALOG_SHEET, "A2:N"),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: seededItems.map(itemToRow) },
      });
      return {
        items: seededItems,
        spreadsheetId: SPREADSHEET_ID,
        sheetName: WEB_CATALOG_SHEET,
        connected: true,
        seeded: true,
        error: null,
      };
    }

    const parsedItems = rows
      .map(rowToItem)
      .filter((item): item is WebCatalogItem => item !== null);

    return {
      items: mergeWithDefaults(parsedItems),
      spreadsheetId: SPREADSHEET_ID,
      sheetName: WEB_CATALOG_SHEET,
      connected: true,
      seeded: false,
      error: null,
    };
  } catch (err) {
    return {
      items: defaultCatalogItems(),
      spreadsheetId: SPREADSHEET_ID,
      sheetName: WEB_CATALOG_SHEET,
      connected: false,
      seeded: false,
      error: err instanceof Error ? err.message : "Web販売商品マスタの読み込みに失敗しました",
    };
  }
}

export async function saveWebCatalogItems(
  rawItems: WebCatalogItem[],
): Promise<WebCatalogItem[]> {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("Google Sheets の接続情報が未設定です");
  }
  const fallbackById = new Map<ProductId, WebCatalogItem>();
  for (const item of defaultCatalogItems()) fallbackById.set(item.productId, item);

  const updatedAt = nowJst();
  const items = rawItems.map((raw) => {
    const fallback = fallbackById.get(raw.productId);
    if (!fallback) {
      throw new Error(`未対応の商品IDです: ${raw.productId}`);
    }
    const priceIncTax = Math.max(1, Math.floor(Number(raw.priceIncTax) || 0));
    return {
      ...fallback,
      productName: String(raw.productName || fallback.productName).trim(),
      sku: String(raw.sku || fallback.sku).trim(),
      category: String(raw.category || fallback.category).trim(),
      priceIncTax,
      stockQuantity:
        raw.stockQuantity === null ? null : Math.max(0, Math.floor(Number(raw.stockQuantity) || 0)),
      salesLimit:
        raw.salesLimit === null ? null : Math.max(0, Math.floor(Number(raw.salesLimit) || 0)),
      status: normalizeStatus(raw.status),
      stopWhenOutOfStock: Boolean(raw.stopWhenOutOfStock),
      stripeProductId: String(raw.stripeProductId ?? "").trim(),
      stripePriceId: String(raw.stripePriceId ?? "").trim(),
      displayOrder: Math.floor(Number(raw.displayOrder) || fallback.displayOrder),
      updatedAt,
      memo: String(raw.memo ?? "").trim(),
    };
  });

  const merged = mergeWithDefaults(items);
  const sheets = getSheetsClient();
  await ensureWebCatalogSheet(sheets, SPREADSHEET_ID);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(WEB_CATALOG_SHEET, "A2:N"),
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(WEB_CATALOG_SHEET, "A2:N"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: merged.map(itemToRow) },
  });
  return merged;
}

function isSellable(item: WebCatalogItem): boolean {
  if (item.status !== "販売中") return false;
  if (
    item.stopWhenOutOfStock &&
    item.stockQuantity !== null &&
    item.stockQuantity <= 0
  ) {
    return false;
  }
  return true;
}

export function isWebCatalogItemSellable(item: WebCatalogItem): boolean {
  return isSellable(item);
}

function availableQuantity(item: WebCatalogItem): number | null {
  const values = [item.stockQuantity, item.salesLimit].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return Math.max(0, Math.min(...values));
}

function applyCatalogItem(product: Product, item: WebCatalogItem): Product {
  return {
    ...product,
    name: item.productName || product.name,
    priceExTax: priceExTaxFromIncTax(item.priceIncTax),
    webAvailableQuantity: availableQuantity(item),
    webCatalogStatus: item.status,
  };
}

export function applyWebCatalogItemToProduct(
  product: Product,
  item: WebCatalogItem,
): Product {
  return applyCatalogItem(product, item);
}

export async function fetchWebOrderProductGroups(): Promise<WebOrderProductGroups> {
  const result = await fetchWebCatalogItems();
  const byId = new Map(result.items.map((item) => [item.productId, item]));

  function applyGroup(products: Product[]): Product[] {
    return products
      .map((product) => {
        const item = byId.get(product.id);
        if (!item || !isSellable(item)) return null;
        return applyCatalogItem(product, item);
      })
      .filter((product): product is Product => product !== null);
  }

  return {
    mainProducts: applyGroup(MAIN_PRODUCTS),
    optionProducts: applyGroup(OPTION_PRODUCTS),
    donationProducts: applyGroup(DONATION_PRODUCTS),
  };
}

export async function resolveRetailCatalogLine(
  productId: ProductId,
): Promise<{ product: Product; item: WebCatalogItem } | null> {
  const product = [...MAIN_PRODUCTS, ...OPTION_PRODUCTS, ...DONATION_PRODUCTS].find(
    (candidate) => candidate.id === productId,
  );
  if (!product) return null;

  const catalog = await fetchWebCatalogItems();
  const item = catalog.items.find((candidate) => candidate.productId === productId);
  if (!item || !isSellable(item)) return null;
  return { product: applyCatalogItem(product, item), item };
}

export function getWebCatalogAvailableQuantity(
  item: WebCatalogItem,
): number | null {
  return availableQuantity(item);
}
