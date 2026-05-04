import { google, sheets_v4 } from "googleapis";

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID ?? "";
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
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchWebOrders(): Promise<WebOrderRow[]> {
  if (!SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${WEB_ORDERS_SHEET}!A2:Q`,
  });
  const rows = res.data.values ?? [];
  return rows.map((row): WebOrderRow => ({
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
  }));
}
