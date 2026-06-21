"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type HottaOrderEditorDetail = {
  lineNo: number;
  productName: string;
  quantity: number;
  unitPriceExTax: number | null;
  subtotalExTax: number | null;
};

export type HottaOrderEditorRow = {
  orderId: string;
  orderedAt: string;
  orderStatus: string;
  priceTier: string;
  partnerId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  desiredDeliveryDate: string;
  deliveryStatus: string;
  billingStatus: string;
  machineModel: string;
  notes: string;
  itemSummary: string;
  details: HottaOrderEditorDetail[];
};

const billingStatuses = [
  "価格確認中",
  "未請求",
  "請求済み",
  "入金済み",
  "キャンセル",
];

function displayValue(value: string): string {
  return value.trim() || "—";
}

function formatYen(value: number | null): string {
  if (value === null) return "—";
  return `¥${value.toLocaleString("ja-JP")}`;
}

function toInputNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseNullableInteger(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.floor(number));
}

function detailSubtotal(detail: HottaOrderEditorDetail): number | null {
  if (detail.unitPriceExTax === null) return null;
  return detail.quantity * detail.unitPriceExTax;
}

function totalQuantity(row: HottaOrderEditorRow): number {
  return row.details.reduce((sum, detail) => sum + detail.quantity, 0);
}

function hottaSubtotal(row: HottaOrderEditorRow): number {
  return row.details.reduce((sum, detail) => {
    const subtotal = detailSubtotal(detail);
    return subtotal === null ? sum : sum + subtotal;
  }, 0);
}

function deliveryBadgeClass(status: string): string {
  if (status === "納品済み") {
    return "border border-emerald-700/40 bg-emerald-900/40 text-emerald-300";
  }
  if (status === "キャンセル") {
    return "border border-red-700/40 bg-red-900/30 text-red-300";
  }
  return "border border-amber-700/40 bg-amber-900/40 text-amber-300";
}

function billingBadgeClass(status: string): string {
  if (status === "価格確認中") {
    return "border border-orange-700/40 bg-orange-900/40 text-orange-200";
  }
  if (status === "請求済み" || status === "入金済み") {
    return "border border-sky-700/40 bg-sky-900/40 text-sky-300";
  }
  if (status === "キャンセル") {
    return "border border-red-700/40 bg-red-900/30 text-red-300";
  }
  return "border border-slate-700 bg-slate-800 text-slate-300";
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "pending";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-5 py-4">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-black ${
          tone === "pending" ? "text-orange-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default function HottaOrdersClient({
  initialRows,
  adminEmail,
  loadError,
}: {
  initialRows: HottaOrderEditorRow[];
  adminEmail: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);

  const stats = useMemo(() => {
    return {
      historyCount: rows.length,
      pendingCount: rows.filter((row) => row.billingStatus === "価格確認中")
        .length,
      quantity: rows.reduce((sum, row) => sum + totalQuantity(row), 0),
    };
  }, [rows]);

  function updateRow<K extends keyof HottaOrderEditorRow>(
    orderId: string,
    key: K,
    value: HottaOrderEditorRow[K],
  ) {
    setRows((current) =>
      current.map((row) =>
        row.orderId === orderId ? { ...row, [key]: value } : row,
      ),
    );
  }

  function updateDetail<K extends keyof HottaOrderEditorDetail>(
    orderId: string,
    lineNo: number,
    key: K,
    value: HottaOrderEditorDetail[K],
  ) {
    setRows((current) =>
      current.map((row) =>
        row.orderId === orderId
          ? {
              ...row,
              details: row.details.map((detail) =>
                detail.lineNo === lineNo ? { ...detail, [key]: value } : detail,
              ),
            }
          : row,
      ),
    );
  }

  async function saveRow(row: HottaOrderEditorRow) {
    if (savingOrderId || row.details.length === 0) return;
    setSavingOrderId(row.orderId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/hotta-orders/${encodeURIComponent(row.orderId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            machineModel: row.machineModel,
            notes: row.notes,
            billingStatus: row.billingStatus,
            details: row.details.map((detail) => ({
              lineNo: detail.lineNo,
              quantity: detail.quantity,
              unitPriceExTax: detail.unitPriceExTax,
            })),
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "保存に失敗しました。");
      }
      setMessage(`${row.orderId} を保存しました。`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">堀田機工</h1>
          <p className="mt-2 text-sm text-slate-500">
            ブラケット注文履歴
          </p>
        </div>
        <p className="text-xs text-slate-500">ログイン中: {adminEmail}</p>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-700/40 bg-emerald-900/30 px-4 py-3 text-sm font-bold text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-xl border border-red-700/40 bg-red-900/20 p-4 text-sm text-red-200">
          <p className="mb-1 font-semibold">保存・読込エラー</p>
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {!error && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatTile label="履歴件数" value={`${stats.historyCount}件`} />
          <StatTile
            label="価格確認中"
            value={`${stats.pendingCount}件`}
            tone="pending"
          />
          <StatTile label="数量合計" value={`${stats.quantity}`} />
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
          まだ堀田機工の注文履歴はありません。
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80">
              <tr className="text-left text-slate-400">
                <th className="px-4 py-3 font-semibold">受注番号</th>
                <th className="px-4 py-3 font-semibold">卸先</th>
                <th className="px-4 py-3 font-semibold">取付機種</th>
                <th className="px-4 py-3 font-semibold">注文内容</th>
                <th className="px-4 py-3 font-semibold">備考</th>
                <th className="px-4 py-3 font-semibold">請求</th>
                <th className="px-4 py-3 font-semibold">納品</th>
                <th className="px-4 py-3 text-right font-semibold">保存</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => {
                const saving = savingOrderId === row.orderId;
                return (
                  <tr
                    key={row.orderId}
                    className="align-top transition-colors hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-200">
                        {displayValue(row.orderId)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {displayValue(row.orderedAt)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {displayValue(row.orderStatus)} /{" "}
                        {displayValue(row.priceTier)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="font-semibold text-white">
                        {displayValue(row.companyName)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {displayValue(row.contactName)} /{" "}
                        {displayValue(row.partnerId)}
                      </div>
                      {(row.email || row.phone) && (
                        <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          {row.email && <div>{row.email}</div>}
                          {row.phone && <div>{row.phone}</div>}
                        </div>
                      )}
                      {row.desiredDeliveryDate && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          希望: {row.desiredDeliveryDate}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#d1a227]"
                        value={row.machineModel}
                        onChange={(event) =>
                          updateRow(
                            row.orderId,
                            "machineModel",
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.details.length > 0 ? (
                        <div className="space-y-3">
                          {row.details.map((detail) => (
                            <div
                              key={`${row.orderId}-${detail.lineNo}`}
                              className="grid grid-cols-[180px_82px_120px_120px] items-center gap-2"
                            >
                              <div className="text-xs font-bold text-slate-200">
                                {displayValue(detail.productName)}
                              </div>
                              <input
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-right font-mono text-sm text-white outline-none transition focus:border-[#d1a227]"
                                min={0}
                                step={1}
                                type="number"
                                value={detail.quantity}
                                onChange={(event) =>
                                  updateDetail(
                                    row.orderId,
                                    detail.lineNo,
                                    "quantity",
                                    Math.max(
                                      0,
                                      Math.floor(Number(event.target.value) || 0),
                                    ),
                                  )
                                }
                              />
                              <input
                                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-right font-mono text-sm text-white outline-none transition focus:border-[#d1a227]"
                                min={0}
                                step={1}
                                type="number"
                                value={toInputNumber(detail.unitPriceExTax)}
                                onChange={(event) =>
                                  updateDetail(
                                    row.orderId,
                                    detail.lineNo,
                                    "unitPriceExTax",
                                    parseNullableInteger(event.target.value),
                                  )
                                }
                              />
                              <div className="text-right font-mono text-xs text-emerald-300">
                                {formatYen(detailSubtotal(detail))}
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end gap-4 border-t border-slate-800 pt-2 text-xs">
                            <span className="text-slate-500">
                              数量 {totalQuantity(row)}
                            </span>
                            <span className="font-mono text-emerald-300">
                              堀田分 {formatYen(hottaSubtotal(row))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="max-w-xs text-xs text-slate-400">
                          {displayValue(row.itemSummary)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        className="h-24 w-60 resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-[#d1a227]"
                        value={row.notes}
                        onChange={(event) =>
                          updateRow(row.orderId, "notes", event.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={`w-32 rounded-md px-2 py-2 text-xs outline-none transition focus:ring-2 focus:ring-[#d1a227]/40 ${billingBadgeClass(
                          row.billingStatus,
                        )}`}
                        value={row.billingStatus || "価格確認中"}
                        onChange={(event) =>
                          updateRow(
                            row.orderId,
                            "billingStatus",
                            event.target.value,
                          )
                        }
                      >
                        {billingStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${deliveryBadgeClass(
                          row.deliveryStatus,
                        )}`}
                      >
                        {displayValue(row.deliveryStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-md bg-[#d1a227] px-4 py-2 text-sm font-black text-white transition hover:bg-[#b88913] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        disabled={saving || row.details.length === 0}
                        type="button"
                        onClick={() => saveRow(row)}
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
