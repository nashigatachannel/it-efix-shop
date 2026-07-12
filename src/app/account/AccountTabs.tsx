"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";

interface AccountOrderItem {
  orderId: string;
  orderedAt: string;
  model: string;
  amountTotal: number | null;
  paymentStatus: string;
  receiptUrl: string | null;
}

type TabKey = "orders" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "orders", label: "注文履歴" },
  { key: "settings", label: "アカウント設定" },
];

function formatYen(amount: number | null): string {
  if (amount === null) return "—";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function statusLabel(status: string): string {
  if (status === "paid") return "入金済";
  if (status === "unpaid") return "入金待ち";
  if (status === "payment_failed") return "支払い失敗";
  if (status === "expired") return "期限切れ";
  return status || "—";
}

function statusBadgeClass(status: string): string {
  if (status === "paid") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (status === "unpaid") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (status === "payment_failed" || status === "expired") {
    return "bg-red-50 text-red-700 border border-red-200";
  }
  return "bg-stone-100 text-stone-600 border border-stone-200";
}

function OrdersPanel() {
  const [orders, setOrders] = useState<AccountOrderItem[] | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/orders")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? "注文履歴の取得に失敗しました。");
        }
        return res.json() as Promise<{
          orders: AccountOrderItem[];
          devHint?: string | null;
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          setOrders(data.orders);
          setDevHint(data.devHint ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "注文履歴の取得に失敗しました。",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (orders === null) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
        読み込み中...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
        <p>注文履歴はありません。</p>
        {devHint && (
          <p className="mx-auto mt-3 max-w-xl rounded-md border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-800">
            {devHint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold text-stone-500">
            <tr>
              <th className="px-4 py-3">注文日時</th>
              <th className="px-4 py-3">注文番号</th>
              <th className="px-4 py-3">商品</th>
              <th className="px-4 py-3 text-right">金額（税込）</th>
              <th className="px-4 py-3">状態</th>
              <th className="px-4 py-3">領収書</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {orders.map((order) => (
              <tr
                key={order.orderId}
                className="transition-colors hover:bg-emerald-50/40"
              >
                <td className="px-4 py-3 text-stone-600">
                  {order.orderedAt || "—"}
                </td>
                <td className="px-4 py-3 font-mono text-stone-700">
                  {order.orderId}
                </td>
                <td className="px-4 py-3 font-semibold text-stone-900">
                  {order.model || "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-emerald-700">
                  {formatYen(order.amountTotal)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs ${statusBadgeClass(
                      order.paymentStatus,
                    )}`}
                  >
                    {statusLabel(order.paymentStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {order.receiptUrl ? (
                    <a
                      href={order.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-md border border-[#0b806b]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#0b806b] hover:bg-[#0b806b] hover:text-white"
                    >
                      表示
                    </a>
                  ) : (
                    <span className="text-xs text-stone-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccountTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("orders");

  return (
    <div>
      <div
        role="tablist"
        aria-label="マイページタブ"
        className="flex gap-2 border-b border-[#eadfce]"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "-mb-px rounded-t-lg px-4 py-2.5 text-sm font-bold transition-colors",
              activeTab === tab.key
                ? "border border-b-0 border-[#eadfce] bg-white text-[#0b806b]"
                : "text-[#607069] hover:text-[#0b806b]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "orders" && <OrdersPanel />}
        {activeTab === "settings" && (
          <div className="flex justify-center">
            <UserProfile routing="hash" />
          </div>
        )}
      </div>
    </div>
  );
}
