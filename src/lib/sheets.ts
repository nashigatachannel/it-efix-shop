import { google, sheets_v4 } from "googleapis";

export const SPREADSHEET_ID =
  process.env.GOOGLE_ORDERS_SPREADSHEET_ID ??
  process.env.GOOGLE_SPREADSHEET_ID ??
  "";
export const WEB_ORDERS_SHEET = "Web注文";
// 卸注文の既定保存先は「EFIX 注文DB」スプシ。旧デフォルト(EFIX販売スプシ)の
// 「卸注文管理」「卸受注明細」ダミータブは2026-07-27に削除済みのため流用不可。
export const DEFAULT_WHOLESALE_SPREADSHEET_ID =
  "19AG4PTu8aAxxzhZ5UiK7TYSKFjGD02uU0VBnB3DdOdg";
export const WHOLESALE_SPREADSHEET_ID =
  process.env.GOOGLE_WHOLESALE_SPREADSHEET_ID ??
  process.env.GOOGLE_ORDERS_SPREADSHEET_ID ??
  process.env.GOOGLE_SPREADSHEET_ID ??
  DEFAULT_WHOLESALE_SPREADSHEET_ID;
export const WHOLESALE_ORDERS_SHEET =
  process.env.GOOGLE_WHOLESALE_ORDERS_SHEET ?? "卸注文管理";
export const WHOLESALE_ORDER_DETAILS_SHEET =
  process.env.GOOGLE_WHOLESALE_ORDER_DETAILS_SHEET ?? "卸受注明細";
export const INSTALLATION_RESERVATION_SHEET = "取付予約";
export const INVENTORY_MASTER_SHEET = "在庫マスタ";

export function getSheetsClient(): sheets_v4.Sheets {
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? "{}"
  ) as Record<string, unknown>;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export function sheetRange(title: string, range: string): string {
  return `'${title.replace(/'/g, "''")}'!${range}`;
}

// V3: 列 A〜Z（26列）。V2 までの A〜S（19列）と互換性を保ちつつ、T〜Z の V3 拡張列を追加。
export interface WebOrderRow {
  serialNumber: number | null;
  subId: string;
  orderedAt: string;
  sessionId: string;
  paymentStatus: string;
  paymentMethod: string;
  model: string;
  amountTotal: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerPostalCode: string;
  customerAddress: string;
  machineMaker: string;
  machineModel: string;
  notes: string;
  invoiceRequested: boolean;
  partnerId: string;
  paymentDueAt: string;
  // V3 追加列
  customerPrefecture: string;
  installationLabel: string;
  desiredDate1: string;
  desiredDate2: string;
  desiredDate3: string;
  installedAt: string;
  returnTrackingNumber: string;
}

export interface WholesaleOrderRow {
  orderId: string;
  orderedAt: string;
  orderStatus: string;
  priceTier: string;
  partnerId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  postalCode: string;
  deliveryAddress: string;
  detailText: string;
  subtotalExTax: number | null;
  tax: number | null;
  totalIncTax: number | null;
  desiredDeliveryDate: string;
  paymentTerms: string;
  notes: string;
  source: string;
  deliveryStatus: string;
  deliveredAt: string;
  billingStatus: string;
  billingMonth: string;
  invoiceNumber: string;
  scheduledInvoiceSendAt: string;
  invoiceSentAt: string;
  updatedAt: string;
}

export interface WholesaleOrderDetailRow {
  orderId: string;
  lineNo: number | null;
  kind: string;
  model: string;
  section: string;
  category: string;
  partNumber: string;
  productName: string;
  quantity: number | null;
  unitPriceExTax: number | null;
  subtotalExTax: number | null;
  stockAllocationStatus: string;
  deliveryStatus: string;
}

export type InstallationStatus =
  | "requested"
  | "proposing"
  | "confirmed"
  | "installed"
  | "cancelled";

export interface InstallationReservationRow {
  orderId: string;
  status: InstallationStatus | string;
  proposalHistory: string;
  confirmedDate: string;
  vendorId: string;
  installedAt: string;
  returnTrackingNumber: string;
  notes: string;
  rowNumber: number;
}

export interface InventoryMasterRow {
  productId: string;
  currentStock: number | null;
  salesLimit: number | null;
  lastAdjustedAt: string;
  notes: string;
  rowNumber: number;
}

export interface HottaWholesaleOrderHistoryRow {
  order: WholesaleOrderRow;
  details: WholesaleOrderDetailRow[];
  machineModel: string;
  notes: string;
  totalQuantity: number;
  itemSummary: string;
}

const HOTTA_BRACKET_PRODUCT_NAMES = new Set([
  "モーター固定金具",
  "アンテナプレート",
  "アンテナブラケット",
  "モニターブラケット",
]);

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRow(row: unknown[]): WebOrderRow {
  return {
    serialNumber: toNumberOrNull(row[0]),
    subId: String(row[1] ?? ""),
    orderedAt: String(row[2] ?? ""),
    sessionId: String(row[3] ?? ""),
    paymentStatus: String(row[4] ?? ""),
    paymentMethod: String(row[5] ?? ""),
    model: String(row[6] ?? ""),
    amountTotal: toNumberOrNull(row[7]),
    customerName: String(row[8] ?? ""),
    customerEmail: String(row[9] ?? ""),
    customerPhone: String(row[10] ?? ""),
    customerPostalCode: String(row[11] ?? ""),
    customerAddress: String(row[12] ?? ""),
    machineMaker: String(row[13] ?? ""),
    machineModel: String(row[14] ?? ""),
    notes: String(row[15] ?? ""),
    invoiceRequested: row[16] === "希望",
    partnerId: String(row[17] ?? ""),
    paymentDueAt: String(row[18] ?? ""),
    customerPrefecture: String(row[19] ?? ""),
    installationLabel: String(row[20] ?? ""),
    desiredDate1: String(row[21] ?? ""),
    desiredDate2: String(row[22] ?? ""),
    desiredDate3: String(row[23] ?? ""),
    installedAt: String(row[24] ?? ""),
    returnTrackingNumber: String(row[25] ?? ""),
  };
}

function parseWholesaleRow(row: unknown[]): WholesaleOrderRow {
  return {
    orderId: String(row[0] ?? ""),
    orderedAt: String(row[1] ?? ""),
    orderStatus: String(row[2] ?? ""),
    priceTier: String(row[3] ?? ""),
    partnerId: String(row[4] ?? ""),
    companyName: String(row[5] ?? ""),
    contactName: String(row[6] ?? ""),
    email: String(row[7] ?? ""),
    phone: String(row[8] ?? ""),
    postalCode: String(row[9] ?? ""),
    deliveryAddress: String(row[10] ?? ""),
    detailText: String(row[11] ?? ""),
    subtotalExTax: toNumberOrNull(row[12]),
    tax: toNumberOrNull(row[13]),
    totalIncTax: toNumberOrNull(row[14]),
    desiredDeliveryDate: String(row[15] ?? ""),
    paymentTerms: String(row[16] ?? ""),
    notes: String(row[17] ?? ""),
    source: String(row[18] ?? ""),
    deliveryStatus: String(row[19] ?? ""),
    deliveredAt: String(row[20] ?? ""),
    billingStatus: String(row[21] ?? ""),
    billingMonth: String(row[22] ?? ""),
    invoiceNumber: String(row[23] ?? ""),
    scheduledInvoiceSendAt: String(row[24] ?? ""),
    invoiceSentAt: String(row[25] ?? ""),
    updatedAt: String(row[26] ?? ""),
  };
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

export function isHottaWholesaleDetail(row: WholesaleOrderDetailRow): boolean {
  return (
    row.section === "堀田機工" ||
    HOTTA_BRACKET_PRODUCT_NAMES.has(row.productName)
  );
}

function hasHottaWholesaleMarker(order: WholesaleOrderRow): boolean {
  return (
    order.notes.includes("堀田機工") ||
    order.detailText.includes("堀田機工") ||
    Array.from(HOTTA_BRACKET_PRODUCT_NAMES).some((name) =>
      order.detailText.includes(name),
    )
  );
}

function extractHottaMachineModel(notes: string): string {
  const bracketMatch = notes.match(/取付機種\s*[：:]\s*【([^】]+)】/u);
  if (bracketMatch?.[1]?.trim()) return bracketMatch[1].trim();

  const plainMatch = notes.match(/取付機種\s*[：:]\s*([^/]+)/u);
  if (plainMatch?.[1]?.trim()) return plainMatch[1].trim();

  return "";
}

function cleanHottaNotes(notes: string): string {
  return notes
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^取付機種\s*[：:]/u.test(part))
    .filter((part) => part !== "堀田機工ブラケット価格未定")
    .join(" / ");
}

export async function fetchWebOrders(): Promise<WebOrderRow[]> {
  if (!SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WEB_ORDERS_SHEET}!A2:Z`,
  });
  return (res.data.values ?? []).map(parseRow);
}

export async function fetchPartnerOrders(
  partnerId: string
): Promise<WebOrderRow[]> {
  if (!SPREADSHEET_ID || !partnerId) return [];
  const all = await fetchWebOrders();
  return all.filter((row) => row.partnerId === partnerId);
}

export async function fetchWholesaleOrders(): Promise<WholesaleOrderRow[]> {
  if (!WHOLESALE_SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return [];
  }
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: WHOLESALE_SPREADSHEET_ID,
    range: sheetRange(WHOLESALE_ORDERS_SHEET, "A2:AA"),
  });
  return (res.data.values ?? []).map(parseWholesaleRow);
}

export async function fetchPartnerWholesaleOrders(
  partnerId: string,
): Promise<WholesaleOrderRow[]> {
  if (!partnerId) return [];
  const all = await fetchWholesaleOrders();
  return all.filter((row) => row.partnerId === partnerId);
}

export async function fetchWholesaleOrderDetails(
  orderId?: string,
): Promise<WholesaleOrderDetailRow[]> {
  if (
    !WHOLESALE_SPREADSHEET_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    orderId === ""
  ) {
    return [];
  }
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: WHOLESALE_SPREADSHEET_ID,
    range: sheetRange(WHOLESALE_ORDER_DETAILS_SHEET, "A2:M"),
  });
  const rows = (res.data.values ?? []).map(parseWholesaleDetailRow);
  return orderId ? rows.filter((row) => row.orderId === orderId) : rows;
}

export async function fetchHottaWholesaleOrderHistory(): Promise<
  HottaWholesaleOrderHistoryRow[]
> {
  const [orders, details] = await Promise.all([
    fetchWholesaleOrders(),
    fetchWholesaleOrderDetails(),
  ]);
  const hottaDetailsByOrderId = new Map<string, WholesaleOrderDetailRow[]>();

  for (const detail of details) {
    if (!detail.orderId || !isHottaWholesaleDetail(detail)) continue;
    const current = hottaDetailsByOrderId.get(detail.orderId) ?? [];
    current.push(detail);
    hottaDetailsByOrderId.set(detail.orderId, current);
  }

  return orders
    .filter(
      (order) =>
        hottaDetailsByOrderId.has(order.orderId) ||
        hasHottaWholesaleMarker(order),
    )
    .map((order) => {
      const hottaDetails = hottaDetailsByOrderId.get(order.orderId) ?? [];
      const totalQuantity = hottaDetails.reduce(
        (sum, detail) => sum + (detail.quantity ?? 0),
        0,
      );
      const itemSummary =
        hottaDetails.length > 0
          ? hottaDetails
              .map((detail) =>
                `${detail.productName || "堀田機工ブラケット"} x${
                  detail.quantity ?? 0
                }`,
              )
              .join(" / ")
          : order.detailText;

      return {
        order,
        details: hottaDetails,
        machineModel: extractHottaMachineModel(order.notes),
        notes: cleanHottaNotes(order.notes),
        totalQuantity,
        itemSummary,
      };
    });
}

function parseInstallationReservationRow(
  row: unknown[],
  rowNumber: number,
): InstallationReservationRow {
  return {
    orderId: String(row[0] ?? ""),
    status: String(row[1] ?? ""),
    proposalHistory: String(row[2] ?? ""),
    confirmedDate: String(row[3] ?? ""),
    vendorId: String(row[4] ?? ""),
    installedAt: String(row[5] ?? ""),
    returnTrackingNumber: String(row[6] ?? ""),
    notes: String(row[7] ?? ""),
    rowNumber,
  };
}

export async function fetchInstallationReservations(): Promise<
  InstallationReservationRow[]
> {
  if (!SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(INSTALLATION_RESERVATION_SHEET, "A2:H"),
  });
  return (res.data.values ?? []).map((row, index) =>
    parseInstallationReservationRow(row, index + 2),
  );
}

function parseInventoryMasterRow(
  row: unknown[],
  rowNumber: number,
): InventoryMasterRow {
  return {
    productId: String(row[0] ?? ""),
    currentStock: toNumberOrNull(row[1]),
    salesLimit: toNumberOrNull(row[2]),
    lastAdjustedAt: String(row[3] ?? ""),
    notes: String(row[4] ?? ""),
    rowNumber,
  };
}

export async function fetchInventoryMaster(): Promise<InventoryMasterRow[]> {
  if (!SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetRange(INVENTORY_MASTER_SHEET, "A2:E"),
  });
  return (res.data.values ?? []).map((row, index) =>
    parseInventoryMasterRow(row, index + 2),
  );
}

export async function fetchPartnerWholesaleOrderWithDetails(
  partnerId: string,
  orderId: string,
): Promise<{
  order: WholesaleOrderRow;
  details: WholesaleOrderDetailRow[];
} | null> {
  const orders = await fetchPartnerWholesaleOrders(partnerId);
  const order = orders.find((row) => row.orderId === orderId);
  if (!order) return null;
  const details = await fetchWholesaleOrderDetails(orderId);
  return { order, details };
}
