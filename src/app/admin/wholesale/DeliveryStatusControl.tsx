"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DeliveryStatusControlProps {
  orderId: string;
  delivered: boolean;
}

export default function DeliveryStatusControl({
  orderId,
  delivered,
}: DeliveryStatusControlProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(delivered);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    if (isSaving) return;
    setChecked(next);
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/wholesale-orders/${encodeURIComponent(orderId)}/delivery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivered: next }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setChecked(!next);
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      router.refresh();
    } catch (err) {
      setChecked(!next);
      setError(err instanceof Error ? err.message : "通信エラー");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={checked}
          disabled={isSaving}
          onChange={(event) => handleChange(event.target.checked)}
          className="sr-only peer"
          aria-label={`${orderId}の納品済みを切り替え`}
        />
        <span className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-slate-700 transition-colors peer-checked:bg-emerald-600 peer-disabled:opacity-50">
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              checked ? "translate-x-4" : ""
            }`}
          />
        </span>
        <span className={checked ? "text-emerald-300" : "text-slate-400"}>
          {isSaving ? "更新中" : checked ? "納品済み" : "未納品"}
        </span>
      </label>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
