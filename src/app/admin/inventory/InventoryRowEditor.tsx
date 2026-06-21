"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface InventoryRowEditorProps {
  productId: string;
  initialCurrentStock: number;
  initialSalesLimit: number;
  initialNotes: string;
  allocated: number;
}

export default function InventoryRowEditor(props: InventoryRowEditorProps) {
  const router = useRouter();
  const [currentStock, setCurrentStock] = useState(
    String(props.initialCurrentStock),
  );
  const [salesLimit, setSalesLimit] = useState(String(props.initialSalesLimit));
  const [notes, setNotes] = useState(props.initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const currentStockNum = Number(currentStock);
  const salesLimitNum = Number(salesLimit);
  const available = Math.max(
    0,
    (Number.isFinite(currentStockNum) ? currentStockNum : 0) - props.allocated,
  );
  const effectiveLimit =
    salesLimitNum > 0 ? Math.min(available, salesLimitNum) : available;
  const isSoldOut = effectiveLimit <= 0;

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(
        `/api/admin/inventory/${encodeURIComponent(props.productId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentStock: Number(currentStock),
            salesLimit: Number(salesLimit),
            notes,
          }),
        },
      );
      const data = (await res.json()) as { error?: string; updatedAt?: string };
      if (!res.ok) {
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      setSavedAt(data.updatedAt ?? "保存しました");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs items-end">
      <div>
        <label className="block text-neutral-600 mb-1">現在庫数</label>
        <input
          type="number"
          min={0}
          value={currentStock}
          onChange={(e) => setCurrentStock(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">
          引当数<span className="text-neutral-400 ml-1">(自動)</span>
        </label>
        <div className="w-full px-2 py-1.5 rounded bg-neutral-50 border border-neutral-200 text-neutral-600 text-right font-mono">
          {props.allocated}
        </div>
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">
          販売可能数<span className="text-neutral-400 ml-1">(計算)</span>
        </label>
        <div
          className={`w-full px-2 py-1.5 rounded border text-right font-mono ${
            isSoldOut
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {effectiveLimit}
        </div>
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">
          販売上限<span className="text-neutral-400 ml-1">(0=制限なし)</span>
        </label>
        <input
          type="number"
          min={0}
          value={salesLimit}
          onChange={(e) => setSalesLimit(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">備考</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-1.5 rounded bg-[#d1a227] text-white font-semibold hover:bg-[#b88b15] disabled:opacity-50"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
        {error && <span className="text-red-700">{error}</span>}
        {savedAt && !error && (
          <span className="text-emerald-700">保存済み: {savedAt}</span>
        )}
        {isSoldOut && !error && (
          <span className="text-red-700">販売可能数 0 - 在庫切れ表示対象</span>
        )}
      </div>
    </div>
  );
}
