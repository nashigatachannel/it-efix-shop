import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSheetsClient, sheetRange } from "@/lib/sheets";

const COOKIE_NAME = "efix_admin";
const ALG = "HS256";
const SESSION_TTL_HOURS = 12;

// 管理者DBスプシ（ユーザー名/パスワード/有効フラグ）。専用スプシIDが未設定ならこの固定IDにフォールバック。
const ADMIN_DB_SHEET = "管理者";
const DEFAULT_ADMIN_DB_SPREADSHEET_ID =
  "11KnsksMthd2kLlwlYJ0c6RycxQedIXUiteopnx2hXFo";

interface AdminPayload {
  email: string;
  iat?: number;
  exp?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_AUTH_SECRET must be set and at least 32 chars long"
    );
  }
  return new TextEncoder().encode(secret);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// 管理者DBスプシ（管理者!A2:C = ユーザー名/パスワード/有効フラグ）を照合する。
// ユーザー名は大文字小文字を区別し、trimのみ行う（メール想定を外したため小文字化しない）。
async function verifyCredentialsFromSheet(
  username: string,
  password: string
): Promise<boolean> {
  const spreadsheetId =
    process.env.ADMIN_DB_SPREADSHEET_ID ?? DEFAULT_ADMIN_DB_SPREADSHEET_ID;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange(ADMIN_DB_SHEET, "A2:C"),
  });
  const rows = res.data.values ?? [];
  const trimmedUsername = username.trim();

  for (const row of rows) {
    const rowUsername = String(row[0] ?? "");
    const rowPassword = String(row[1] ?? "");
    const isEnabled = String(row[2] ?? "").trim().toUpperCase() === "TRUE";
    if (!isEnabled) continue;
    if (rowUsername !== trimmedUsername) continue;
    if (timingSafeEqual(password, rowPassword)) return true;
  }
  return false;
}

// 環境変数(ADMIN_EMAIL/ADMIN_PASSWORD)による従来認証。締め出し防止のフォールバック用。
function verifyCredentialsFromEnv(username: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  return (
    timingSafeEqual(
      username.trim().toLowerCase(),
      adminEmail.trim().toLowerCase()
    ) && timingSafeEqual(password, adminPassword)
  );
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  try {
    if (await verifyCredentialsFromSheet(username, password)) return true;
  } catch (error) {
    console.error("[admin-auth] 管理者DBスプシの照合に失敗しました:", error);
  }
  // スプシで一致しなかった場合・APIエラー時は従来のenv認証にフォールバック（締め出し防止）。
  return verifyCredentialsFromEnv(username, password);
}

export async function createSessionToken(email: string): Promise<string> {
  return await new SignJWT({ email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (typeof payload.email !== "string") return null;
    return { email: payload.email, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentAdmin(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
