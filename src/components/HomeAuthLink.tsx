"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

/**
 * ホームページ(page.tsx)専用のログイン/マイページリンク。
 * page.tsx自体をClient Componentにせず static(○) のまま維持するため、
 * Clerkのログイン状態判定だけをこの小さなClient Componentに分離している。
 */
export default function HomeAuthLink() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <Link
        href="/account"
        className="hidden text-sm font-semibold text-[#394842] transition-colors hover:text-[#b58a36] md:inline"
      >
        マイページ
      </Link>
    );
  }

  return (
    <Link
      href="/sign-in"
      className="hidden text-sm font-semibold text-[#394842] transition-colors hover:text-[#b58a36] md:inline"
    >
      ログイン
    </Link>
  );
}
