import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSheetsClient, SPREADSHEET_ID } from "@/lib/sheets";

export const PARTNER_COOKIE = "efix_partner";
const ALG = "HS256";
const SESSION_TTL_HOURS = 24;
const PARTNER_MASTER_RANGE = "卸先マスタ!A2:K";

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

function getSecret(): Uint8Array {
  const secret = process.env.PARTNER_AUTH_SECRET;
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
 * Sheets「卸先マスタ」を引いてemail+passwordをチェックする (Node.js runtime only)。
 */
export async function authenticatePartner(
  email: string,
  password: string
): Promise<PartnerProfile | null> {
  if (!SPREADSHEET_ID) return null;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: PARTNER_MASTER_RANGE,
  });
  const rows = res.data.values ?? [];
  const targetEmail = email.trim().toLowerCase();

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
    if (String(rowEmail).trim().toLowerCase() !== targetEmail) continue;
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
  if (!SPREADSHEET_ID) return null;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: PARTNER_MASTER_RANGE,
  });
  const rows = res.data.values ?? [];
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
