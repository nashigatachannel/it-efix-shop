"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";

interface AccountOrderItem {
  orderId: string;
  orderedAt: string;
  model: string;
  amountTotal: number | null;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
}

interface CustomerProfile {
  name: string;
  phone: string;
  postalCode: string;
  prefecture: string;
  addressDetail: string;
}

type TabKey = "orders" | "profile" | "settings";

const TABS: { key: TabKey; label: string }[] = [
  { key: "orders", label: "注文履歴" },
  { key: "profile", label: "お客様情報" },
  { key: "settings", label: "アカウント設定" },
];

function formatYen(amount: number | null): string {
  if (amount === null) return "—";
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/** シート上の支払方法表記を顧客向け表示に揃える。 */
function paymentMethodDisplay(method: string): string {
  if (method === "カード") return "クレジットカード";
  return method || "—";
}

/** 未入金・失敗など、適格請求書を発行できない注文の状態表示。 */
function pendingStatusLabel(status: string): string {
  if (status === "unpaid") return "入金待ち";
  if (status === "payment_failed") return "支払い失敗";
  if (status === "expired") return "期限切れ";
  return "—";
}

function ReceiptModal({
  order,
  onClose,
}: {
  order: AccountOrderItem;
  onClose: () => void;
}) {
  const [addressee, setAddressee] = useState(order.customerName);
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
      });
      const res = await fetch(`/api/account/orders/receipt?${query}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "適格請求書の発行に失敗しました。");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${order.orderId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "適格請求書の発行に失敗しました。",
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
      aria-label="適格請求書の発行"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-base font-bold text-stone-900">適格請求書の発行</h3>
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
        <p className="mt-2 text-xs text-stone-500">
          商品の内訳・金額・支払方法はご注文内容から自動で記載されます。
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
              <th className="px-4 py-3">支払方法</th>
              <th className="px-4 py-3">適格請求書</th>
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
                <td className="px-4 py-3 text-stone-700">
                  {paymentMethodDisplay(order.paymentMethod)}
                </td>
                <td className="px-4 py-3">
                  {order.paymentStatus === "paid" ? (
                    <button
                      type="button"
                      onClick={() => setReceiptOrder(order)}
                      className="inline-flex rounded-md bg-[#0b806b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0a6f5d]"
                    >
                      宛名入り適格請求書
                    </button>
                  ) : (
                    <span className="text-xs text-stone-400">
                      {pendingStatusLabel(order.paymentStatus)}
                    </span>
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
      <p className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
        ご注文のキャンセルは{" "}
        <a
          href="/orders/cancel"
          className="font-bold text-[#0b806b] hover:underline"
        >
          こちら
        </a>
        （上記の注文番号とご登録のメールアドレスまたは電話番号が必要です）
      </p>
    </div>
  );
}

const PROFILE_FIELDS: Array<{
  key: keyof CustomerProfile;
  label: string;
  placeholder: string;
}> = [
  { key: "name", label: "お名前", placeholder: "山田 太郎" },
  { key: "phone", label: "電話番号", placeholder: "090-1234-5678" },
  { key: "postalCode", label: "郵便番号", placeholder: "062-0041" },
  { key: "prefecture", label: "都道府県", placeholder: "北海道" },
  {
    key: "addressDetail",
    label: "市町村以下の住所（お届け先）",
    placeholder: "札幌市豊平区福住一条７丁目4-13",
  },
];

function ProfilePanel() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/account/profile")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? "お客様情報の取得に失敗しました。");
        }
        return res.json() as Promise<{
          profile: CustomerProfile;
          email: string;
        }>;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data.profile);
          setEmail(data.email);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "お客様情報の取得に失敗しました。",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "お客様情報の保存に失敗しました。");
      }
      setSavedAt(Date.now());
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "お客様情報の保存に失敗しました。",
      );
    } finally {
      setSaving(false);
    }
  };

  if (error && profile === null) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-stone-600">
        ここに登録した内容は、次回のご注文フォームに自動で入力されます。
        ご注文時に入力・変更した内容も自動でこちらに反映されます。
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-bold text-stone-600 sm:col-span-2">
          メールアドレス（ログインアカウント）
          <input
            type="text"
            value={email}
            disabled
            className="mt-1 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-normal text-stone-500"
          />
        </label>

        {PROFILE_FIELDS.map((field) => (
          <label
            key={field.key}
            className={[
              "block text-xs font-bold text-stone-600",
              field.key === "addressDetail" ? "sm:col-span-2" : "",
            ].join(" ")}
          >
            {field.label}
            <input
              type="text"
              value={profile[field.key]}
              placeholder={field.placeholder}
              onChange={(event) =>
                setProfile((prev) =>
                  prev ? { ...prev, [field.key]: event.target.value } : prev,
                )
              }
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-normal text-stone-900 focus:border-[#0b806b] focus:outline-none"
            />
          </label>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        {savedAt && !saving && (
          <span className="text-xs text-emerald-700">保存しました</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[#0b806b] px-5 py-2 text-sm font-bold text-white hover:bg-[#0a6f5d] disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
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
        {activeTab === "profile" && <ProfilePanel />}
        {activeTab === "settings" && (
          <div className="flex justify-center">
            <UserProfile routing="hash" />
          </div>
        )}
      </div>
    </div>
  );
}
