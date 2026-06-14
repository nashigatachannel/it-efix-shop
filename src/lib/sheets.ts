import { google, sheets_v4 } from "googleapis";

export const SPREADSHEET_ID =
  process.env.GOOGLE_ORDERS_SPREADSHEET_ID ??
  process.env.GOOGLE_SPREADSHEET_ID ??
  "";
export const WEB_ORDERS_SHEET = "Web注文";

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
