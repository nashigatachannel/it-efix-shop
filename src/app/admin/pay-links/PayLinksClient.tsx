"use client";

import { useState } from "react";
import type { UnpaidInvoiceRow } from "@/lib/sales-sheet";

function formatYen(n: number): string {
  if (!n) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default function PayLinksClient({ rows }: { rows: UnpaidInvoiceRow[] }) {
  const [linksByInv, setLinksByInv] = useState<Record<number, string>>({});
  const [errorByInv, setErrorByInv] = useState<Record<number, string>>({});
  const [generatingInv, setGeneratingInv] = useState<number | null>(null);
  const [copyHint, setCopyHint] = useState<string>("");

  async function generateLink(invNumber: number) {
    setGeneratingInv(invNumber);
    setErrorByInv((prev) => ({ ...prev, [invNumber]: "" }));

    try {
      const res = await fetch("/api/admin/pay-links/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invNumber }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "リンク生成に失敗しました");
      }
      setLinksByInv((prev) => ({ ...prev, [invNumber]: data.url! }));
    } catch (err) {
      setErrorByInv((prev) => ({
        ...prev,
        [invNumber]: err instanceof Error ? err.message : "エラーが発生しました",
      }));
    } finally {
      setGeneratingInv(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("コピーしました");
      setTimeout(() => setCopyHint(""), 2000);
    } catch {
      setCopyHint("コピーに失敗しました");
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-black text-neutral-950">
          未入金の請求書はありません
        </h2>
        <p className="mt-3 text-sm text-neutral-600">
          シート1のX列にINV番号があり、G列(入金日)が空欄のレコードがここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {copyHint && <p className="text-sm font-bold text-[#0b806b]">{copyHint}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-[#fbf5e8]">
            <tr className="border-b border-neutral-200 text-left text-neutral-700">
              <th className="w-24 px-4 py-3 font-black">通し番号</th>
              <th className="w-32 px-4 py-3 font-black">請求書番号</th>
              <th className="w-48 px-4 py-3 font-black">顧客名</th>
              <th className="w-32 px-4 py-3 text-right font-black">金額</th>
              <th className="px-4 py-3 font-black">支払いリンク</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const link = linksByInv[row.invNumber];
              const error = errorByInv[row.invNumber];
              const isGenerating = generatingInv === row.invNumber;
              return (
                <tr
                  key={row.rowIndex}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-4 py-4 font-mono text-neutral-800">
                    {row.serial || "—"}
                  </td>
                  <td className="px-4 py-4 font-bold text-neutral-950">
                    {row.invDisplay}
                  </td>
                  <td className="px-4 py-4 text-neutral-700">
                    {row.customerName || "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-neutral-800">
                    {formatYen(row.amountJpy)}
                  </td>
                  <td className="px-4 py-4">
                    {!link ? (
                      <button
                        type="button"
                        onClick={() => generateLink(row.invNumber)}
                        disabled={isGenerating}
                        className="rounded-md bg-[#d1a227] px-4 py-2 text-xs font-black text-white transition hover:bg-[#b98c1c] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isGenerating ? "生成中…" : "リンク生成"}
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={link}
                          onFocus={(e) => e.target.select()}
                          aria-label={`${row.invDisplay} の支払いリンク`}
                          className="min-w-[280px] flex-1 rounded-md border border-neutral-200 px-2 py-1.5 font-mono text-xs text-neutral-700"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(link)}
                          className="rounded-md bg-[#0b806b] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#0a6f5d]"
                        >
                          コピー
                        </button>
                      </div>
                    )}
                    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
