"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InstallationStatus } from "@/lib/sheets";

interface InstallationRowEditorProps {
  orderId: string;
  initialStatus: string;
  initialConfirmedDate: string;
  initialVendorId: string;
  initialInstalledAt: string;
  initialReturnTrackingNumber: string;
  initialNotes: string;
}

const STATUS_OPTIONS: { value: InstallationStatus; label: string }[] = [
  { value: "requested", label: "希望日受領" },
  { value: "proposing", label: "業者打診中" },
  { value: "confirmed", label: "日程確定" },
  { value: "installed", label: "取付完了" },
  { value: "cancelled", label: "キャンセル" },
];

function statusBadgeClass(status: string): string {
  if (status === "requested") return "bg-amber-50 text-amber-700";
  if (status === "proposing") return "bg-sky-50 text-sky-700";
  if (status === "confirmed") return "bg-indigo-50 text-indigo-700";
  if (status === "installed") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-600";
}

export default function InstallationRowEditor(
  props: InstallationRowEditorProps,
) {
  const router = useRouter();
  const [status, setStatus] = useState(props.initialStatus);
  const [confirmedDate, setConfirmedDate] = useState(props.initialConfirmedDate);
  const [vendorId, setVendorId] = useState(props.initialVendorId);
  const [installedAt, setInstalledAt] = useState(props.initialInstalledAt);
  const [returnTrackingNumber, setReturnTrackingNumber] = useState(
    props.initialReturnTrackingNumber,
  );
  const [notes, setNotes] = useState(props.initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(
        `/api/admin/installations/${encodeURIComponent(props.orderId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            confirmedDate,
            vendorId,
            installedAt,
            returnTrackingNumber,
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
      <div>
        <label className="block text-neutral-600 mb-1">ステータス</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] ${statusBadgeClass(status)}`}
        >
          {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
        </span>
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">確定日</label>
        <input
          type="date"
          value={confirmedDate}
          onChange={(e) => setConfirmedDate(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">担当業者ID</label>
        <input
          type="text"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          placeholder="V001 等"
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">取付完了日</label>
        <input
          type="date"
          value={installedAt}
          onChange={(e) => setInstalledAt(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
        />
      </div>

      <div>
        <label className="block text-neutral-600 mb-1">返送伝票番号</label>
        <input
          type="text"
          value={returnTrackingNumber}
          onChange={(e) => setReturnTrackingNumber(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-[#d1a227]/30"
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

      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
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
      </div>
    </div>
  );
}
