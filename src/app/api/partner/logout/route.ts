import { NextRequest, NextResponse } from "next/server";
import { PARTNER_COOKIE } from "@/lib/partner-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL("/partner/login", request.url),
    303
  );
  response.cookies.delete(PARTNER_COOKIE);
  return response;
}
