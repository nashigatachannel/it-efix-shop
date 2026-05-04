import { NextRequest, NextResponse } from "next/server";
import { clearPartnerCookie } from "@/lib/partner-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  await clearPartnerCookie();
  return NextResponse.redirect(
    new URL("/partner/login", request.url),
    303
  );
}
