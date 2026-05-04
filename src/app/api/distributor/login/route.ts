import { NextRequest, NextResponse } from "next/server";
import {
  verifyRolePassword,
  createRoleToken,
  setRoleCookie,
} from "@/lib/role-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await new Promise((r) => setTimeout(r, 200));
  if (!body.password || !verifyRolePassword("distributor", body.password)) {
    return NextResponse.json(
      { error: "パスワードが正しくありません" },
      { status: 401 }
    );
  }
  const token = await createRoleToken("distributor");
  await setRoleCookie("distributor", token);
  return NextResponse.json({ ok: true });
}
