import { clerkClient } from "@clerk/nextjs/server";

/**
 * 顧客プロフィール（マイページで編集・注文フォームへ自動入力）。
 * 保存先は Clerk の privateMetadata.customerProfile（サーバーからのみ読み書き）。
 * メールアドレスは Clerk のログインメールが真実のため保存しない。
 */
export interface CustomerProfile {
  name: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  addressDetail: string;
}

export const EMPTY_PROFILE: CustomerProfile = {
  name: "",
  phone: "",
  postalCode: "",
  prefecture: "",
  addressDetail: "",
};

const FIELD_MAX_LENGTH: Record<keyof CustomerProfile, number> = {
  name: 60,
  phone: 20,
  postalCode: 10,
  prefecture: 10,
  addressDetail: 120,
};

/**
 * 入力値をプロフィール形に正規化する。未知のキーは捨て、
 * 各フィールドは trim + 上限文字数で切り詰める。
 */
export function sanitizeProfile(input: unknown): CustomerProfile {
  const source = (input ?? {}) as Record<string, unknown>;
  const profile = { ...EMPTY_PROFILE };
  for (const key of Object.keys(profile) as Array<keyof CustomerProfile>) {
    const value = source[key];
    if (typeof value === "string") {
      profile[key] = value.trim().slice(0, FIELD_MAX_LENGTH[key]);
    }
  }
  return profile;
}

export async function fetchCustomerProfile(
  userId: string,
): Promise<CustomerProfile> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return sanitizeProfile(user.privateMetadata?.customerProfile);
}

export async function saveCustomerProfile(
  userId: string,
  profile: CustomerProfile,
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { customerProfile: profile },
  });
}

/** プロフィールに1フィールドでも値が入っているか。 */
export function hasProfileValues(profile: CustomerProfile): boolean {
  return Object.values(profile).some((value) => value !== "");
}
