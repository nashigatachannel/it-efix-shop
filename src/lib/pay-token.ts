import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 請求書カード払いの署名付きトークン (HMAC-SHA256)。
 * ペイロードに INV 番号(正規化済み整数)と有効期限を載せ、URL-safe base64 で運搬する。
 * 外部ライブラリは使わず Node の crypto のみで完結させる。
 */

const TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60; // 発行から60日

interface PayTokenPayload {
  inv: number;
  exp: number;
}

export type VerifyPayTokenResult =
  | { ok: true; inv: number }
  | { ok: false; error: "invalid" | "expired" };

function getSecret(): string {
  const secret = process.env.PAY_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PAY_LINK_SECRET must be set and at least 32 chars long");
  }
  return secret;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

function sign(payloadB64: string): string {
  const hmac = createHmac("sha256", getSecret());
  hmac.update(payloadB64);
  return base64UrlEncode(hmac.digest());
}

/** INV番号(正規化済み整数)から署名付きトークンを発行する。 */
export function createPayToken(invNumber: number): string {
  const payload: PayTokenPayload = {
    inv: invNumber,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureB64 = sign(payloadB64);
  return `${payloadB64}.${signatureB64}`;
}

/** トークンの署名と有効期限を検証する。改ざん/期限切れはそれぞれ別エラーで返す。 */
export function verifyPayToken(token: string): VerifyPayTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "invalid" };
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return { ok: false, error: "invalid" };

  let expectedSignature: string;
  try {
    expectedSignature = sign(payloadB64);
  } catch {
    return { ok: false, error: "invalid" };
  }

  const expectedBuf = Buffer.from(expectedSignature);
  const actualBuf = Buffer.from(signatureB64);
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return { ok: false, error: "invalid" };
  }

  let payload: PayTokenPayload;
  try {
    payload = JSON.parse(
      base64UrlDecode(payloadB64).toString("utf8"),
    ) as PayTokenPayload;
  } catch {
    return { ok: false, error: "invalid" };
  }

  if (
    typeof payload.inv !== "number" ||
    !Number.isFinite(payload.inv) ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return { ok: false, error: "invalid" };
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) {
    return { ok: false, error: "expired" };
  }

  return { ok: true, inv: payload.inv };
}
