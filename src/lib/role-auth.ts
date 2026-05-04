import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "wholesale" | "distributor";

const ALG = "HS256";
const SESSION_TTL_HOURS = 24;

export const ROLE_COOKIE: Record<Role, string> = {
  wholesale: "efix_wholesale",
  distributor: "efix_distributor",
};

export const ROLE_LABEL: Record<Role, string> = {
  wholesale: "通常卸",
  distributor: "特価卸",
};

interface RolePayload {
  role: Role;
  iat?: number;
  exp?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.ROLE_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ROLE_AUTH_SECRET must be at least 32 chars");
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

function getPasswordForRole(role: Role): string | null {
  if (role === "wholesale") return process.env.WHOLESALE_PASSWORD ?? null;
  if (role === "distributor") return process.env.DISTRIBUTOR_PASSWORD ?? null;
  return null;
}

export function verifyRolePassword(role: Role, password: string): boolean {
  const expected = getPasswordForRole(role);
  if (!expected) return false;
  return timingSafeEqual(password, expected);
}

export async function createRoleToken(role: Role): Promise<string> {
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecret());
}

export async function verifyRoleToken(
  token: string
): Promise<RolePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (
      typeof payload.role !== "string" ||
      (payload.role !== "wholesale" && payload.role !== "distributor")
    ) {
      return null;
    }
    return { role: payload.role, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export async function setRoleCookie(role: Role, token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ROLE_COOKIE[role],
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function clearRoleCookie(role: Role): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ROLE_COOKIE[role]);
}

export async function getCurrentRole(role: Role): Promise<RolePayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ROLE_COOKIE[role])?.value;
  if (!token) return null;
  return verifyRoleToken(token);
}
