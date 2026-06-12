import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSheetsClient, SPREADSHEET_ID } from "@/lib/sheets";

export const PARTNER_COOKIE = "efix_partner";
const ALG = "HS256";
const SESSION_TTL_HOURS = 24;
const EFIX_SALES_SPREADSHEET_ID = "1rD8a6c9g2Y-8ucGXu2Dajy2O57wwI0C3lkou5I3OB9Q";
const NORMAL_PARTNER_MASTER_SHEET =
  process.env.GOOGLE_PARTNER_MASTER_SHEET || "通常卸一覧";
const SPECIAL_PARTNER_MASTER_SHEET =
  process.env.GOOGLE_SPECIAL_PARTNER_MASTER_SHEET || "特価卸一覧";
const LEGACY_PARTNER_MASTER_RANGE = "卸先マスタ!A2:K";
const DEV_PARTNER_AUTH_SECRET =
  "efix-local-development-partner-secret-20260527";
export const PARTNER_SESSION_TTL_SECONDS = SESSION_TTL_HOURS * 3600;

export type PartnerTier = "wholesale" | "distributor";

export interface PartnerProfile {
  partnerId: string;
  companyName: string;
  contactName: string;
  email: string;
  tier: PartnerTier;
  phone: string;
  postalCode: string;
  address: string;
}

interface PartnerJwtPayload {
  partnerId: string;
  companyName: string;
  tier: PartnerTier;
  iat?: number;
  exp?: number;
}

type PartnerSheetRecord = PartnerProfile & {
  loginUser: string;
  password: string;
  enabled: boolean;
};

type HeaderMap = Record<string, number>;

function getSecret(): Uint8Array {
  const secret = process.env.PARTNER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") {
    return new TextEncoder().encode(DEV_PARTNER_AUTH_SECRET);
  }
  if (!secret || secret.length < 32) {
    throw new Error("PARTNER_AUTH_SECRET must be at least 32 chars");
  }
  return new TextEncoder().encode(secret);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * EFIX 販売.gsheet のID。未指定なら共有フォルダ内の「EFIX 販売」を読む。
 */
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

function cell(row: unknown[], index: number | null): string {
  if (index === null) return "";
  return String(row[index] ?? "").trim();
}

function isTruthyEnabled(value: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return !["false", "0", "no", "ng", "無効", "停止", "不可"].includes(
    normalized,
  );
}

function partnerRecordFromRow(
  row: unknown[],
  map: HeaderMap,
  rowNumber: number,
  tier: PartnerTier,
): PartnerSheetRecord | null {
  const userIndex = indexOfAny(map, [
    "ユーザー",
    "ユーザー名",
    "ログインID",
    "ID",
    "メール",
    "メールアドレス",
    "email",
  ]);
  const passwordIndex = indexOfAny(map, [
    "パスワード",
    "password",
    "pass",
    "PW",
  ]);

  const loginUser = cell(row, userIndex);
  const password = cell(row, passwordIndex);
  if (!loginUser || !password) return null;

  const companyName =
    cell(row, indexOfAny(map, ["会社名", "販売店名", "屋号", "取引先名"])) ||
    loginUser;
  const contactName = cell(row, indexOfAny(map, ["担当者", "担当者名", "氏名"]));
  const email =
    cell(
      row,
      indexOfAny(map, [
        "メール",
        "メールアドレス",
        "mail",
        "mailアドレス",
        "ｍａｉｌ",
        "ｍａｉｌアドレス",
        "email",
      ]),
    ) ||
    (loginUser.includes("@") ? loginUser : "");
  const phone = cell(row, indexOfAny(map, ["電話", "電話番号", "TEL"]));
  const postalCode = cell(row, indexOfAny(map, ["郵便番号", "郵便", "〒"]));
  const address = cell(row, indexOfAny(map, ["住所", "所在地", "納品先住所"]));
  const partnerId =
    cell(row, indexOfAny(map, ["販売店ID", "取引先ID", "partnerId", "ID"])) ||
    loginUser ||
    `normal-wholesale-${rowNumber}`;
  const enabled = isTruthyEnabled(
    cell(row, indexOfAny(map, ["有効", "enabled", "利用可", "ステータス"])),
  );

  return {
    partnerId,
    loginUser,
    companyName,
    contactName,
    email,
    tier,
    phone,
    postalCode,
    address,
    password,
    enabled,
  };
}

function toPartnerProfile(record: PartnerSheetRecord): PartnerProfile {
  return {
    partnerId: record.partnerId,
    companyName: record.companyName,
    contactName: record.contactName,
    email: record.email,
    tier: record.tier,
    phone: record.phone,
    postalCode: record.postalCode,
    address: record.address,
  };
}

function devPartnerRecords(): PartnerSheetRecord[] {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PARTNER_TEST_ACCOUNTS !== "true"
  ) {
    return [];
  }

  return [
    {
      partnerId: "WS-001",
      loginUser: "okuhara@partner-test.efix.local",
      companyName: "（株）奥原商会",
      contactName: "（テスト担当）",
      email: "okuhara@partner-test.efix.local",
      tier: "wholesale",
      phone: "",
      postalCode: "",
      address: "",
      password: "Okuhara2026!",
      enabled: true,
    },
    {
      partnerId: "TEST-02",
      loginUser: "test02",
      companyName: "Test Partner 02",
      contactName: "Test User",
      email: "test02@partner-test.efix.local",
      tier: "wholesale",
      phone: "",
      postalCode: "",
      address: "",
      password: "1234",
      enabled: true,
    },
    {
      partnerId: "TEST-01-SPECIAL",
      loginUser: "test01",
      companyName: "Test Special 01",
      contactName: "Test User",
      email: "test01@partner-test.efix.local",
      tier: "distributor",
      phone: "",
      postalCode: "",
      address: "",
      password: "1234",
      enabled: true,
    },
    {
      partnerId: "DS-001",
      loginUser: "oi@partner-test.efix.local",
      companyName: "（株）大井アグリサポート",
      contactName: "（テスト担当）",
      email: "oi@partner-test.efix.local",
      tier: "distributor",
      phone: "",
      postalCode: "",
      address: "",
      password: "OiAgri2026!",
      enabled: true,
    },
    {
      partnerId: "DS-002",
      loginUser: "takahashi@partner-test.efix.local",
      companyName: "高橋サービス",
      contactName: "（テスト担当）",
      email: "takahashi@partner-test.efix.local",
      tier: "distributor",
      phone: "",
      postalCode: "",
      address: "",
      password: "Takahashi2026!",
      enabled: true,
    },
    {
      partnerId: "DS-003",
      loginUser: "tsukamoto@partner-test.efix.local",
      companyName: "塚本忠行（個人事業主）",
      contactName: "塚本 忠行",
      email: "tsukamoto@partner-test.efix.local",
      tier: "distributor",
      phone: "",
      postalCode: "",
      address: "",
      password: "Tsukamoto2026!",
      enabled: true,
    },
  ];
}

async function fetchPartnerSheetRecords(
  sheetName: string,
  tier: PartnerTier,
): Promise<PartnerSheetRecord[]> {
  const spreadsheetId = partnerSpreadsheetId();
  if (!spreadsheetId) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'!A:Z`,
  });
  const rows = res.data.values ?? [];
  const [headers, ...body] = rows;
  if (!headers?.length) return [];
  const map = buildHeaderMap(headers);
  return body
    .map((row, index) => partnerRecordFromRow(row, map, index + 2, tier))
    .filter((record): record is PartnerSheetRecord => Boolean(record));
}

async function fetchAllPartnerSheetRecords(): Promise<PartnerSheetRecord[]> {
  const [normalRecords, specialRecords] = await Promise.all([
    fetchPartnerSheetRecords(NORMAL_PARTNER_MASTER_SHEET, "wholesale"),
    fetchPartnerSheetRecords(SPECIAL_PARTNER_MASTER_SHEET, "distributor"),
  ]);
  return [...normalRecords, ...specialRecords];
}

async function fetchLegacyPartnerRows() {
  if (!SPREADSHEET_ID) return [];
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: LEGACY_PARTNER_MASTER_RANGE,
  });
  return res.data.values ?? [];
}

/**
 * EFIX 販売.gsheet「通常卸」を引いてユーザー+パスワードをチェックする (Node.js runtime only)。
 */
export async function authenticatePartner(
  email: string,
  password: string
): Promise<PartnerProfile | null> {
  const targetUser = email.trim().toLowerCase();

  let partnerSheetRecords: PartnerSheetRecord[] = [];
  let partnerSheetLookupFailed = false;
  try {
    partnerSheetRecords = await fetchAllPartnerSheetRecords();
  } catch (err) {
    console.warn("Partner sheet lookup failed:", err);
    partnerSheetLookupFailed = true;
  }
  if (process.env.NODE_ENV === "production" && partnerSheetLookupFailed) {
    throw new Error("Partner sheet lookup failed");
  }
  partnerSheetRecords = [
    ...partnerSheetRecords,
    ...devPartnerRecords(),
  ];
  for (const record of partnerSheetRecords) {
    const loginCandidates = [
      record.loginUser,
      record.partnerId,
      record.email,
      record.companyName,
    ]
      .filter(Boolean)
      .map((value) => value.trim().toLowerCase());
    if (!record.enabled) continue;
    if (!loginCandidates.includes(targetUser)) continue;
    if (!timingSafeEqualStr(password, record.password)) return null;
    return toPartnerProfile(record);
  }

  let rows: unknown[][] = [];
  try {
    rows = await fetchLegacyPartnerRows();
  } catch (err) {
    console.warn("Legacy partner master lookup failed:", err);
  }
  for (const row of rows) {
    const [
      partnerId,
      companyName,
      contactName,
      rowEmail,
      rowPassword,
      tierRaw,
      phone,
      postalCode,
      address,
      enabled,
    ] = row;
    if (!rowEmail || !rowPassword) continue;
    if (String(enabled).toUpperCase() !== "TRUE") continue;
    if (String(rowEmail).trim().toLowerCase() !== targetUser) continue;
    if (!timingSafeEqualStr(password, String(rowPassword))) return null;

    const tier =
      String(tierRaw).trim() === "distributor" ? "distributor" : "wholesale";
    return {
      partnerId: String(partnerId ?? ""),
      companyName: String(companyName ?? ""),
      contactName: String(contactName ?? ""),
      email: String(rowEmail),
      tier,
      phone: String(phone ?? ""),
      postalCode: String(postalCode ?? ""),
      address: String(address ?? ""),
    };
  }
  return null;
}

/**
 * partnerIdから現在のプロフィールを引き直す（注文時など）。
 */
export async function fetchPartnerById(
  partnerId: string
): Promise<PartnerProfile | null> {
  let partnerSheetRecords: PartnerSheetRecord[] = [];
  let partnerSheetLookupFailed = false;
  try {
    partnerSheetRecords = await fetchAllPartnerSheetRecords();
  } catch (err) {
    console.warn("Partner sheet lookup failed:", err);
    partnerSheetLookupFailed = true;
  }
  if (process.env.NODE_ENV === "production" && partnerSheetLookupFailed) {
    throw new Error("Partner sheet lookup failed");
  }
  partnerSheetRecords = [
    ...partnerSheetRecords,
    ...devPartnerRecords(),
  ];
  const normalRecord = partnerSheetRecords.find(
    (record) => record.partnerId.trim() === partnerId && record.enabled,
  );
  if (normalRecord) {
    return toPartnerProfile(normalRecord);
  }

  let rows: unknown[][] = [];
  try {
    rows = await fetchLegacyPartnerRows();
  } catch (err) {
    console.warn("Legacy partner master lookup failed:", err);
  }
  for (const row of rows) {
    const [
      rowId,
      companyName,
      contactName,
      email,
      ,
      tierRaw,
      phone,
      postalCode,
      address,
      enabled,
    ] = row;
    if (String(rowId ?? "").trim() !== partnerId) continue;
    if (String(enabled).toUpperCase() !== "TRUE") return null;
    const tier =
      String(tierRaw).trim() === "distributor" ? "distributor" : "wholesale";
    return {
      partnerId,
      companyName: String(companyName ?? ""),
      contactName: String(contactName ?? ""),
      email: String(email ?? ""),
      tier,
      phone: String(phone ?? ""),
      postalCode: String(postalCode ?? ""),
      address: String(address ?? ""),
    };
  }
  return null;
}

export async function createPartnerToken(
  profile: PartnerProfile
): Promise<string> {
  return await new SignJWT({
    partnerId: profile.partnerId,
    companyName: profile.companyName,
    tier: profile.tier,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecret());
}

export async function verifyPartnerToken(
  token: string
): Promise<PartnerJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      typeof payload.partnerId !== "string" ||
      typeof payload.companyName !== "string" ||
      (payload.tier !== "wholesale" && payload.tier !== "distributor")
    ) {
      return null;
    }
    return {
      partnerId: payload.partnerId,
      companyName: payload.companyName,
      tier: payload.tier,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function setPartnerCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: PARTNER_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function clearPartnerCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PARTNER_COOKIE);
}

export async function getCurrentPartner(): Promise<PartnerJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARTNER_COOKIE)?.value;
  if (!token) return null;
  return verifyPartnerToken(token);
}
