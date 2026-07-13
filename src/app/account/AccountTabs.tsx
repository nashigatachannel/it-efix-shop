"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";

interface AccountOrderItem {
  orderId: string;
  orderedAt: string;
  model: string;
  amountTotal: number | null;
  paymentStatus: string;
  customerName: string;
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

function ReceiptModal({
  order,
  onClose,
}: {
  order: AccountOrderItem;
  onClose: () => void;
}) {
  const [addressee, setAddressee] = useState(order.customerName);
  const [note, setNote] = useState(`${order.model || "E-FIX製品"} 代金`);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!addressee.trim()) {
      setError("宛名を入力してください。");
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const query = new URLSearchParams({
        orderId: order.orderId,
        to: addressee.trim(),
        note: note.trim(),
      });
      const res = await fetch(`/api/account/orders/receipt?${query}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "領収書の発行に失敗しました。");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${order.orderId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "領収書の発行に失敗しました。",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="領収書の発行"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-bold text-stone-900">領収書の発行</h3>
        <p className="mt-1 text-xs text-stone-500">
          注文番号 {order.orderId}・{formatYen(order.amountTotal)}（税込）
        </p>

        <label className="mt-4 block text-xs font-bold text-stone-600">
          宛名
          <input
            type="text"
            value={addressee}
            maxLength={60}
            onChange={(event) => setAddressee(event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 focus:border-[#0b806b] focus:outline-none"
          />
        </label>
        <p className="mt-1 text-right text-xs text-stone-400">※「様」は自動で付きます</p>

        <label className="mt-3 block text-xs font-bold text-stone-600">
          但し書き
          <input
            type="text"
            value={note}
            maxLength={80}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 focus:border-[#0b806b] focus:outline-none"
          />
        </label>
        <p className="mt-1 text-right text-xs text-stone-400">
          ※「但し」「として」は自動で付きます
        </p>

        {error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-md bg-[#0b806b] px-4 py-2 text-sm font-bold text-white hover:bg-[#0a6f5d] disabled:opacity-50"
          >
            {downloading ? "生成中..." : "PDFをダウンロード"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersPanel() {
  const [orders, setOrders] = useState<AccountOrderItem[] | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<AccountOrderItem | null>(
    null,
  );

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
                  {order.paymentStatus === "paid" ? (
                    <button
                      type="button"
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex rounded-md bg-[#0b806b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0a6f5d]"
                    >
                      宛名入り領収書
                    </button>
                  ) : (
                    <span className="text-xs text-stone-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          onClose={() => setReceiptOrder(null)}
        />
      )}
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
