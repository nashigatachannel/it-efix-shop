import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  fetchCustomerProfile,
  sanitizeProfile,
  saveCustomerProfile,
} from "@/lib/customer-profile";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [profile, user] = await Promise.all([
      fetchCustomerProfile(userId),
      currentUser(),
    ]);
    const email = user?.primaryEmailAddress?.emailAddress ?? "";
    return NextResponse.json({ profile, email });
  } catch (err) {
    console.error("Failed to fetch customer profile:", err);
    return NextResponse.json(
      { error: "お客様情報の取得に失敗しました。" },
      { status: 502 },
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const profile = sanitizeProfile((body as { profile?: unknown })?.profile);

  try {
    await saveCustomerProfile(userId, profile);
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("Failed to save customer profile:", err);
    return NextResponse.json(
      { error: "お客様情報の保存に失敗しました。" },
      { status: 502 },
    );
  }
}
