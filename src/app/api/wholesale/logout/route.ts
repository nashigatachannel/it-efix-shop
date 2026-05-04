import { NextResponse } from "next/server";
import { clearRoleCookie } from "@/lib/role-auth";

export async function POST(): Promise<NextResponse> {
  await clearRoleCookie("wholesale");
  return NextResponse.json({ ok: true });
}
