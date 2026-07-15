import { getSheetsClient, sheetRange } from "@/lib/sheets";

/**
 * 請求書カード払い機能のためのEFIX販売スプシ「シート1」照合ライブラリ。
 * 現実世界で契約〜納品済みの売掛(freee請求書=INV)をカードで回収するための専用ルート。
 * ECの受注フロー(sheets.ts の Web注文/卸注文管理)とはデータソースも列構成も完全に別。
 *
 * 注意: GOOGLE_WHOLESALE_SPREADSHEET_ID は環境によって「EFIX 注文DB」など別のスプシを
 * 指すよう上書きされていることがあるため、フォールバック先には流用しない。
 */

// EFIX販売スプシ(シート1 / 入金自動連係 / 顧客LINEマスタ を持つブック)固有のID。
const DEFAULT_SALES_SPREADSHEET_ID = "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q";

export const SALES_SPREADSHEET_ID =
  process.env.GOOGLE_SALES_SPREADSHEET_ID ?? DEFAULT_SALES_SPREADSHEET_ID;

const SHEET1 = "シート1";
const DATA_START_ROW = 7; // ヘッダ行=6行目、データ=7行目〜
const PAYMENT_LINK_SHEET = "入金自動連係";
const LINE_MASTER_SHEET = "顧客LINEマスタ";

// シート1 列インデックス(0-based)。A=0, E=4, F=5, G=6, I=8, P=15, X=23, AN=39, AO=40, AP=41
const COL_SERIAL = 0; // A 通し番号
const COL_PAID_DATE = 6; // G 入金日
const COL_CUSTOMER_NAME = 8; // I ユーザー名
const COL_AMOUNT = 15; // P 価格税込
const COL_INV = 23; // X INV番号

function toStr(v: unknown): string {
  return String(v ?? "").trim();
}

function parseAmountJpy(raw: unknown): number {
  const cleaned = toStr(raw).replace(/[¥,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * INV番号を数値に正規化する。'INV-0000000097' / 'INV-97' / '97' / 97 いずれも 97 になる。
 * 数字が見つからなければ null。
 */
export function normalizeInvNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const match = String(raw).match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** 正規化済みINV番号から短縮表示 'INV-97' を作る。 */
export function formatInvDisplay(invNumber: number): string {
  return `INV-${invNumber}`;
}

function formatMonthDayJst(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${month}/${day}`;
}

function formatYmdSlashJst(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}/${month}/${day}`;
}

function formatJstDateTimeString(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export interface SalesInvoiceRow {
  /** シート1上の実際の行番号(1-based)。更新/追記時に使う。 */
  rowIndex: number;
  serial: string;
  customerName: string;
  amountJpy: number;
  /** G列の生値。空文字なら未入金。 */
  paidDate: string;
  invDisplay: string;
}

/** シート1をX列(INV番号)で検索する。見つからなければ null。 */
export async function findInvoiceRow(
  invNumber: number,
): Promise<SalesInvoiceRow | null> {
  if (!SALES_SPREADSHEET_ID) return null;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(SHEET1, `A${DATA_START_ROW}:AP`),
  });
  const values = res.data.values ?? [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const invRaw = toStr(row[COL_INV]);
    if (!invRaw) continue;
    if (normalizeInvNumber(invRaw) !== invNumber) continue;

    return {
      rowIndex: i + DATA_START_ROW,
      serial: toStr(row[COL_SERIAL]),
      customerName: toStr(row[COL_CUSTOMER_NAME]),
      amountJpy: parseAmountJpy(row[COL_AMOUNT]),
      paidDate: toStr(row[COL_PAID_DATE]),
      invDisplay: formatInvDisplay(invNumber),
    };
  }
  return null;
}

export interface UnpaidInvoiceRow {
  rowIndex: number;
  serial: string;
  invDisplay: string;
  invNumber: number;
  customerName: string;
  amountJpy: number;
}

/** X列にINVがありG列(入金日)が空の行、つまり未入金の請求書一覧。管理画面のリンク生成用。 */
export async function listUnpaidInvoiceRows(): Promise<UnpaidInvoiceRow[]> {
  if (!SALES_SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(SHEET1, `A${DATA_START_ROW}:AP`),
  });
  const values = res.data.values ?? [];

  const rows: UnpaidInvoiceRow[] = [];
  values.forEach((row, index) => {
    const invRaw = toStr(row[COL_INV]);
    const paidDate = toStr(row[COL_PAID_DATE]);
    if (!invRaw || paidDate) return;
    const invNumber = normalizeInvNumber(invRaw);
    if (invNumber === null) return;

    rows.push({
      rowIndex: index + DATA_START_ROW,
      serial: toStr(row[COL_SERIAL]),
      invDisplay: formatInvDisplay(invNumber),
      invNumber,
      customerName: toStr(row[COL_CUSTOMER_NAME]),
      amountJpy: parseAmountJpy(row[COL_AMOUNT]),
    });
  });
  return rows;
}

export interface RecordCardPaymentParams {
  rowIndex: number;
  serial: string;
  customerName: string;
  invDisplay: string;
  amountJpy: number;
  feeJpy: number;
  paymentIntentId: string;
  paidAtJst: Date;
}

export interface RecordCardPaymentResult {
  /** true なら G列が既に埋まっていたため上書きしていない(要確認扱い)。 */
  gColumnAlreadyFilled: boolean;
  gValueUsed: string;
  /** true なら同一paymentIntentIdで記帳済みだった(Stripe webhookの再送による重複)ため何もしていない。 */
  alreadyRecordedForThisPayment: boolean;
}

/**
 * カード決済完了をシート1に記帳し、入金自動連係タブに突合レコードを追加する。
 * G列(入金日)は既に非空なら上書きしない(二重記帳/手入力上書き事故を防ぐ)。
 * Stripe webhookは再送されうるため、AP列(Stripe決済ID)が既に同じpaymentIntentIdなら
 * 完全な重複配信とみなしノーオペで返す(連係タブへの重複追記や誤った「要確認」注記を避ける)。
 */
export async function recordCardPayment(
  params: RecordCardPaymentParams,
): Promise<RecordCardPaymentResult> {
  const sheets = getSheetsClient();
  const mdValue = formatMonthDayJst(params.paidAtJst);

  const currentRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(SHEET1, `G${params.rowIndex}:AP${params.rowIndex}`),
  });
  const currentRow = currentRes.data.values?.[0] ?? [];
  const currentG = toStr(currentRow[0]); // G は範囲先頭(オフセット0)
  const currentAp = toStr(currentRow[35]); // AP-G = 41-6 = 35

  if (currentAp && currentAp === params.paymentIntentId) {
    return {
      gColumnAlreadyFilled: currentG.length > 0,
      gValueUsed: currentG || mdValue,
      alreadyRecordedForThisPayment: true,
    };
  }

  const gColumnAlreadyFilled = currentG.length > 0;
  const gValueUsed = gColumnAlreadyFilled ? currentG : mdValue;

  if (!gColumnAlreadyFilled) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SALES_SPREADSHEET_ID,
      range: sheetRange(SHEET1, `G${params.rowIndex}`),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[mdValue]] },
    });
  }

  // AN=入金経路, AO=カード手数料, AP=Stripe決済ID
  await sheets.spreadsheets.values.update({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(SHEET1, `AN${params.rowIndex}:AP${params.rowIndex}`),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["カード", params.feeJpy, params.paymentIntentId]],
    },
  });

  const detailNote = gColumnAlreadyFilled
    ? `Stripeカード決済 ${params.invDisplay}（G列既記入あり・要確認）`
    : `Stripeカード決済 ${params.invDisplay}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(PAYMENT_LINK_SHEET, "A:M"),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          formatYmdSlashJst(params.paidAtJst),
          params.customerName,
          params.amountJpy,
          "✅ 記帳済み(カード)",
          params.serial,
          params.customerName,
          gValueUsed,
          detailNote,
          "",
          formatJstDateTimeString(new Date()),
          "カード",
          params.feeJpy,
          params.paymentIntentId,
        ],
      ],
    },
  });

  return {
    gColumnAlreadyFilled,
    gValueUsed,
    alreadyRecordedForThisPayment: false,
  };
}

export interface UpsertLineBindingParams {
  customerName: string;
  userId: string;
  displayName: string;
  triggerInvDisplay: string;
}

/**
 * 顧客LINEマスタに (顧客名, LINE userId) の組を登録/更新する。
 * 既存なら最終利用日時(E列)だけ更新、無ければ新規append。
 * 呼び出し元(line-bindingルート)側で失敗を握りつぶす前提のため、ここでは例外をそのまま投げる。
 */
export async function upsertLineBinding(
  params: UpsertLineBindingParams,
): Promise<void> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(LINE_MASTER_SHEET, "A2:H"),
  });
  const values = res.data.values ?? [];
  const nowJst = formatJstDateTimeString(new Date());

  const index = values.findIndex(
    (row) =>
      toStr(row[0]) === params.customerName && toStr(row[1]) === params.userId,
  );

  if (index >= 0) {
    const rowNumber = index + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SALES_SPREADSHEET_ID,
      range: sheetRange(LINE_MASTER_SHEET, `E${rowNumber}`),
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nowJst]] },
    });
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SALES_SPREADSHEET_ID,
    range: sheetRange(LINE_MASTER_SHEET, "A:H"),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          params.customerName,
          params.userId,
          params.displayName,
          nowJst,
          nowJst,
          params.triggerInvDisplay,
          "有効",
          "",
        ],
      ],
    },
  });
}
