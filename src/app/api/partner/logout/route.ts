import { NextResponse } from "next/server";
import { clearPartnerCookie } from "@/lib/partner-auth";

export async function POST(): Promise<NextResponse> {
  await clearPartnerCookie();
  return NextResponse.json({ ok: true });
}
