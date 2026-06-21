"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    if (isPending) return;
    setIsPending(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50 hover:text-red-600 disabled:opacity-50"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M10 17 15 12l-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </svg>
      {isPending ? "処理中" : "ログアウト"}
    </button>
  );
}
