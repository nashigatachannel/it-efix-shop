"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  WebCatalogItem,
  WebCatalogLoadResult,
  WebCatalogStatus,
} from "@/lib/web-catalog";

type FeatureIconName = "tag" | "boxes" | "limit" | "ban" | "link";

type FeatureCard = {
  title: string;
  description: string;
  action?: string;
  icon: FeatureIconName;
  metric?: string;
};

const statuses: WebCatalogStatus[] = ["販売中", "停止中", "在庫切れ"];

function toNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.floor(number));
}

function availableQuantity(item: WebCatalogItem): number | null {
  const values = [item.stockQuantity, item.salesLimit].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return Math.max(0, Math.min(...values));
}

function FeatureIcon({ name }: { name: FeatureIconName }) {
  const common = {
    className: "h-14 w-14 text-[#c89518]",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (name === "tag") {
    return (
      <svg {...common}>
        <path d="M20 13 13 20 4 11V4h7l9 9Z" />
        <circle cx="8" cy="8" r="1.2" />
      </svg>
    );
  }
  if (name === "boxes") {
    return (
      <svg {...common}>
        <path d="M8 4h8v6H8z" />
        <path d="M4 14h8v6H4z" />
        <path d="M12 14h8v6h-8z" />
        <path d="M12 10v4" />
      </svg>
    );
  }
  if (name === "limit") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <text
          x="12"
          y="14.5"
          fill="currentColor"
          fontSize="7"
          fontWeight="700"
          stroke="none"
          textAnchor="middle"
        >
          10
        </text>
      </svg>
    );
  }
  if (name === "ban") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="m6.4 17.6 11.2-11.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10 5.9" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1L14 18.1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </svg>
  );
}

function FeatureCard({ card }: { card: FeatureCard }) {
  return (
    <div className="flex min-h-[230px] flex-col items-center justify-between rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <div className="flex flex-col items-center">
        <FeatureIcon name={card.icon} />
        <h2 className="mt-5 text-lg font-black leading-snug text-neutral-950">
          {card.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          {card.description}
        </p>
      </div>
      {card.metric ? (
        <div className="mt-5 rounded-full bg-[#fbf4df] px-5 py-2 text-sm font-black text-[#9a700d]">
          {card.metric}
        </div>
      ) : (
        <a
          href="#web-catalog-table"
          className="mt-5 w-full whitespace-nowrap rounded-md border border-[#d1a227] px-3 py-3 text-xs font-black text-[#b48513] transition hover:bg-[#fbf4df]"
        >
          {card.action}
        </a>
      )}
    </div>
  );
}

function stockStatusLabel(item: WebCatalogItem): string {
  if (item.status !== "販売中") return item.status;
  const available = availableQuantity(item);
  if (available !== null && available <= 0) return "在庫切れ";
  return "販売中";
}

function stockStatusClass(item: WebCatalogItem): string {
  const label = stockStatusLabel(item);
  if (label === "販売中") return "bg-emerald-50 text-emerald-700";
  if (label === "在庫切れ") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-700";
}

export default function WebCatalogClient({
  catalog,
  adminEmail,
}: {
  catalog: WebCatalogLoadResult;
  adminEmail: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<WebCatalogItem[]>(catalog.items);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(
    catalog.seeded
      ? "Web販売商品マスタを新規作成し、現在の商品を初期投入しました。"
      : null,
  );
  const [error, setError] = useState<string | null>(catalog.error);

  const stats = useMemo(() => {
    const selling = items.filter((item) => stockStatusLabel(item) === "販売中");
    const stockControlled = items.filter((item) => item.stockQuantity !== null);
    const limited = items.filter((item) => item.salesLimit !== null);
    const stripeLinked = items.filter(
      (item) => item.stripeProductId || item.stripePriceId,
    );
    return {
      selling: selling.length,
      stockControlled: stockControlled.length,
      limited: limited.length,
      stripeLinked: stripeLinked.length,
      autoStop:
        items.length > 0 && items.every((item) => item.stopWhenOutOfStock),
    };
  }, [items]);

  const featureCards: FeatureCard[] = [
    {
      title: "Web販売価格の更新",
      description: "Webサイトに表示する販売価格を設定・更新します。",
      action: "価格を更新する",
      icon: "tag",
    },
    {
      title: "在庫数の設定",
      description: "各商品の在庫数を設定し、販売可否に反映します。",
      action: "在庫数を設定する",
      icon: "boxes",
      metric: `${stats.stockControlled}件`,
    },
    {
      title: "10台限定など販売上限の設定",
      description: "各商品の販売上限数を設定します。",
      action: "販売上限を設定する",
      icon: "limit",
      metric: `${stats.limited}件`,
    },
    {
      title: "在庫切れ時の販売停止",
      description: "在庫が0になった商品を販売不可にします。",
      icon: "ban",
      metric: stats.autoStop ? "有効" : "一部のみ",
    },
    {
      title: "Stripe商品/価格との紐づけ",
      description: "Stripeの商品・価格IDを紐づけて管理します。",
      action: "紐づけを管理する",
      icon: "link",
      metric: `${stats.stripeLinked}件`,
    },
  ];

  function updateItem<K extends keyof WebCatalogItem>(
    productId: string,
    key: K,
    value: WebCatalogItem[K],
  ) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, [key]: value } : item,
      ),
    );
  }

  async function saveAll() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/web-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await res.json()) as {
        items?: WebCatalogItem[];
        error?: string;
      };
      if (!res.ok || !data.items) {
        throw new Error(data.error ?? "保存に失敗しました");
      }
      setItems(data.items);
      setMessage("Web販売商品マスタを保存しました。");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-7 border-b-2 border-[#d1a227] pb-5">
        <h1 className="text-4xl font-black tracking-tight text-neutral-950">
          Web販売の価格・在庫管理
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-600">
          <span>ログイン中: {adminEmail}</span>
          <span>
            接続先: {catalog.connected ? "EFIX 注文DB" : "未接続"} /{" "}
            {catalog.sheetName}
          </span>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {featureCards.map((card) => (
          <FeatureCard key={card.title} card={card} />
        ))}
      </section>

      <section id="web-catalog-table" className="mt-7">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-black text-neutral-950">
              商品一覧{" "}
              <span className="text-base font-bold text-neutral-600">
                ({items.length}件 / 販売中 {stats.selling}件)
              </span>
            </h2>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 shadow-sm transition hover:border-[#d1a227] hover:text-[#a77806]"
            >
              <RefreshIcon />
              最新の情報に更新
            </button>
          </div>
          <button
            type="button"
            onClick={saveAll}
            disabled={isSaving || !catalog.connected}
            className="rounded-md bg-[#d1a227] px-8 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#bd8f17] disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {isSaving ? "保存中..." : "一括更新"}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[1580px] text-sm">
            <thead className="bg-[#fbf5e8]">
              <tr className="border-b border-neutral-200 text-left text-neutral-700">
                <th className="w-72 px-4 py-3 font-black">商品名</th>
                <th className="w-36 px-4 py-3 font-black">SKU</th>
                <th className="w-44 px-4 py-3 text-center font-black">
                  Web販売価格
                  <br />
                  （税込）
                </th>
                <th className="w-32 px-4 py-3 text-center font-black">在庫数</th>
                <th className="w-40 px-4 py-3 text-center font-black">
                  販売上限数
                </th>
                <th className="w-36 px-4 py-3 text-center font-black">
                  販売状況
                </th>
                <th className="w-40 px-4 py-3 text-center font-black">
                  在庫0で停止
                </th>
                <th className="w-44 px-4 py-3 font-black">Stripe 商品ID</th>
                <th className="w-44 px-4 py-3 font-black">Stripe 価格ID</th>
                <th className="w-52 px-4 py-3 font-black">メモ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.productId}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <div className="font-black text-neutral-950">
                      {item.productName}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <span>{item.category}</span>
                      <span className="font-mono">{item.productId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      value={item.sku}
                      onChange={(event) =>
                        updateItem(item.productId, "sku", event.target.value)
                      }
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center rounded-md border border-neutral-200 bg-white px-3 focus-within:border-[#d1a227] focus-within:ring-2 focus-within:ring-[#d1a227]/20">
                      <span className="font-bold text-neutral-500">¥</span>
                      <input
                        type="number"
                        min={1}
                        value={item.priceIncTax}
                        onChange={(event) =>
                          updateItem(
                            item.productId,
                            "priceIncTax",
                            Math.max(1, Math.floor(Number(event.target.value) || 0)),
                          )
                        }
                        className="h-10 w-full border-0 px-2 text-right font-mono text-sm font-bold focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      placeholder="未設定"
                      value={item.stockQuantity ?? ""}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "stockQuantity",
                          toNumberOrNull(event.target.value),
                        )
                      }
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 text-right font-mono text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      placeholder="制限なし"
                      value={item.salesLimit ?? ""}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "salesLimit",
                          toNumberOrNull(event.target.value),
                        )
                      }
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 text-right font-mono text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <select
                      value={item.status}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "status",
                          event.target.value as WebCatalogStatus,
                        )
                      }
                      className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm font-bold focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div
                      className={`mx-auto mt-2 w-fit rounded-md px-3 py-1 text-xs font-black ${stockStatusClass(
                        item,
                      )}`}
                    >
                      {stockStatusLabel(item)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <label className="inline-flex items-center justify-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.stopWhenOutOfStock}
                        onChange={(event) =>
                          updateItem(
                            item.productId,
                            "stopWhenOutOfStock",
                            event.target.checked,
                          )
                        }
                        className="peer sr-only"
                      />
                      <span className="relative inline-flex h-7 w-12 rounded-full bg-neutral-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-5" />
                      <span className="text-xs font-bold text-neutral-600">
                        {item.stopWhenOutOfStock ? "有効" : "無効"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-4">
                    <input
                      value={item.stripeProductId}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "stripeProductId",
                          event.target.value,
                        )
                      }
                      placeholder="prod_..."
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      value={item.stripePriceId}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "stripePriceId",
                          event.target.value,
                        )
                      }
                      placeholder="price_..."
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 font-mono text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <input
                      value={item.memo}
                      onChange={(event) =>
                        updateItem(item.productId, "memo", event.target.value)
                      }
                      placeholder="管理メモ"
                      className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm focus:border-[#d1a227] focus:outline-none focus:ring-2 focus:ring-[#d1a227]/20"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-neutral-500">
          価格は税込で入力します。保存後、Web販売の表示価格・Checkout作成時の価格・販売可否チェックに反映されます。
          在庫数または販売上限数を入れると、購入可能数の上限として扱います。
        </p>
      </section>
    </div>
  );
}
