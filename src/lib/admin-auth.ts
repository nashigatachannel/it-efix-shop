import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "efix_admin";
const ALG = "HS256";
const SESSION_TTL_HOURS = 12;

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

export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return false;
  return (
    timingSafeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase()) &&
    timingSafeEqual(password, adminPassword)
  );
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
