import { NextRequest, NextResponse } from "next/server";
import {
  verifyCredentials,
  createSessionToken,
  setSessionCookie,
} from "@/lib/admin-auth";

interface LoginRequest {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LoginRequest;
  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = body.email ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "メールアドレスとパスワードを入力してください" },
      { status: 400 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  if (!verifyCredentials(email, password)) {
    return NextResponse.json(
      { error: "認証に失敗しました" },
      { status: 401 }
    );
  }

  const token = await createSessionToken(email);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
