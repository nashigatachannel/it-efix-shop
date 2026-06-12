import { NextRequest, NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/partner-auth";
import { getSheetsClient } from "@/lib/sheets";

export const runtime = "nodejs";

const EFIX_SALES_SPREADSHEET_ID =
  "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q";
const NORMAL_PARTNER_MASTER_SHEET =
  process.env.GOOGLE_PARTNER_MASTER_SHEET || "通常卸一覧";
const SPECIAL_PARTNER_MASTER_SHEET =
  process.env.GOOGLE_SPECIAL_PARTNER_MASTER_SHEET || "特価卸一覧";

type HeaderMap = Record<string, number>;

interface PartnerProfilePatch {
  contactName?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
}

function partnerSpreadsheetId(): string {
  return (
    process.env.GOOGLE_PARTNER_SPREADSHEET_ID ||
    process.env.GOOGLE_SALES_SPREADSHEET_ID ||
    EFIX_SALES_SPREADSHEET_ID
  );
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ 　_\-・/]/g, "");
}

function buildHeaderMap(headers: unknown[]): HeaderMap {
  return headers.reduce<HeaderMap>((map, header, index) => {
    const key = normalizeHeader(header);
    if (key) map[key] = index;
    return map;
  }, {});
}

function indexOfAny(map: HeaderMap, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const exact = map[normalizeHeader(candidate)];
    if (exact !== undefined) return exact;
  }
  const entries = Object.entries(map);
  for (const candidate of candidates.map(normalizeHeader)) {
    const found = entries.find(([key]) => key.includes(candidate));
    if (found) return found[1];
  }
  return null;
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetNameForTier(tier: string): string {
  return tier === "distributor"
    ? SPECIAL_PARTNER_MASTER_SHEET
    : NORMAL_PARTNER_MASTER_SHEET;
}

function valueFromBody(value: unknown): string {
  return String(value ?? "").trim();
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getCurrentPartner();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: PartnerProfilePatch;
  try {
    body = (await request.json()) as PartnerProfilePatch;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = valueFromBody(body.email);
  const phone = valueFromBody(body.phone);
  const contactName = valueFromBody(body.contactName);
  const postalCode = valueFromBody(body.postalCode);
  const address = valueFromBody(body.address);

  if (!email || !phone) {
    return NextResponse.json(
      { error: "メールアドレスと電話番号を入力してください。" },
      { status: 400 },
    );
  }

  const spreadsheetId = partnerSpreadsheetId();
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return NextResponse.json(
      { error: "Google Sheets保存先が未設定です。" },
      { status: 500 },
    );
  }

  const sheetName = sheetNameForTier(session.tier);
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'!A:Z`,
  });
  const rows = res.data.values ?? [];
  const [headers, ...bodyRows] = rows;
  if (!headers?.length) {
    return NextResponse.json(
      { error: "販売店マスタの見出し行が見つかりません。" },
      { status: 500 },
    );
  }

  const headerMap = buildHeaderMap(headers);
  const idIndex = indexOfAny(headerMap, ["ID", "ログインID", "販売店ID", "取引先ID"]);
  if (idIndex === null) {
    return NextResponse.json(
      { error: "販売店マスタにID列が見つかりません。" },
      { status: 500 },
    );
  }

  const rowOffset = bodyRows.findIndex(
    (row) => String(row[idIndex] ?? "").trim() === session.partnerId,
  );
  if (rowOffset < 0) {
    return NextResponse.json(
      { error: "ログイン中のID行が販売店マスタに見つかりません。" },
      { status: 404 },
    );
  }

  const rowNumber = rowOffset + 2;
  const updates: Array<{ index: number; value: string }> = [];
  const maybePush = (index: number | null, value: string) => {
    if (index !== null) updates.push({ index, value });
  };

  maybePush(indexOfAny(headerMap, ["担当者", "担当者名", "氏名"]), contactName);
  maybePush(
    indexOfAny(headerMap, [
      "メール",
      "メールアドレス",
      "mail",
      "mailアドレス",
      "ｍａｉｌ",
      "ｍａｉｌアドレス",
      "email",
    ]),
    email,
  );
  maybePush(indexOfAny(headerMap, ["電話", "電話番号", "TEL"]), phone);
  maybePush(indexOfAny(headerMap, ["郵便番号", "郵便", "〒"]), postalCode);
  maybePush(indexOfAny(headerMap, ["住所", "所在地", "納品先住所"]), address);

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "更新できる連絡先列が見つかりません。" },
      { status: 500 },
    );
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map((update) => ({
        range: `'${sheetName.replace(/'/g, "''")}'!${columnName(update.index)}${rowNumber}`,
        values: [[update.value]],
      })),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "連絡先を販売店マスタへ登録しました。",
  });
}
