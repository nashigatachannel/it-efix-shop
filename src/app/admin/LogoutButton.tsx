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
      className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "ログアウト"}
    </button>
  );
}
