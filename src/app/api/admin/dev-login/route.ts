import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/admin-auth";

function isLocalHost(host: string | null): boolean {
  const hostname = (host ?? "").split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production" || !isLocalHost(request.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL is not configured" },
      { status: 500 },
    );
  }

  const token = await createSessionToken(email);
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
