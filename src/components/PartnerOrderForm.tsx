"use client";

import { useMemo, useState } from "react";
import {
  MAIN_PRODUCTS,
  OPTION_PRODUCTS,
  calcTaxIncluded,
  formatPrice,
  getPriceForTier,
  type PriceTier,
  type ProductId,
  type Product,
} from "@/lib/products";

interface PartnerOrderFormProps {
  tier: PriceTier;
  tierLabel: string;
  defaults: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    postalCode: string;
    address: string;
  };
}

interface CustomerInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  notes: string;
}

interface PriceItem {
  id: ProductId;
  name: string;
  description: string;
  priceExTax: number;
  priceIncTax: number;
}

function buildPriceItems(products: Product[], tier: PriceTier): PriceItem[] {
  return products
    .filter((p) => getPriceForTier(p, tier) !== null)
    .map((p) => {
      const ex = getPriceForTier(p, tier) ?? p.priceExTax;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        priceExTax: ex,
        priceIncTax: calcTaxIncluded(ex),
      };
    });
}

export default function PartnerOrderForm({
  tier,
  tierLabel,
  defaults,
}: PartnerOrderFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<CustomerInput>({
    companyName: defaults.companyName,
    contactName: defaults.contactName,
    email: defaults.email,
    phone: defaults.phone,
    postalCode: defaults.postalCode,
    address: defaults.address,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useMemo(() => buildPriceItems(MAIN_PRODUCTS, tier), [tier]);
  const options = useMemo(() => buildPriceItems(OPTION_PRODUCTS, tier), [tier]);

  const allItems = useMemo(() => [...products, ...options], [products, options]);
  const lines = useMemo(
    () =>
      allItems
        .map((p) => ({ item: p, quantity: quantities[p.id] ?? 0 }))
        .filter((l) => l.quantity > 0),
    [allItems, quantities]
  );
  const totalIncTax = lines.reduce(
    (sum, l) => sum + l.item.priceIncTax * l.quantity,
    0
  );

  const handleQty = (id: string, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setQuantities((prev) => ({ ...prev, [id]: 0 }));
      return;
    }
    setQuantities((prev) => ({ ...prev, [id]: Math.min(99, Math.floor(n)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (lines.length === 0) {
      setError("製品またはオプションの数量を1以上指定してください");
      return;
    }
    if (!customer.companyName.trim() || !customer.contactName.trim()) {
      setError("会社名・ご担当者名を入力してください");
      return;
    }
    if (!customer.email.trim() || !customer.phone.trim()) {
      setError("メールアドレス・電話番号を入力してください");
      return;
    }
    if (!customer.postalCode.trim() || !customer.address.trim()) {
      setError("お届け先 郵便番号・住所を入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            productId: l.item.id as ProductId,
            quantity: l.quantity,
          })),
          customer: {
            name: `${customer.companyName} ${customer.contactName}`.trim(),
            email: customer.email,
            phone: customer.phone,
            postalCode: customer.postalCode,
            address: customer.address,
            machineMaker: "",
            machineModel: "",
            notes: customer.notes,
          },
          priceTier: tier,
          requestInvoice: true,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "決済セッション生成に失敗しました");
        setIsSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50";

  const tierAccent =
    tier === "distributor" ? "text-amber-400" : "text-emerald-400";

  const renderRow = (p: PriceItem) => (
    <div
      key={p.id}
      className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-lg p-4"
    >
      <div className="flex-1">
        <p className="text-white font-bold">{p.name}</p>
        <p className="text-xs text-slate-500 mt-1">{p.description}</p>
      </div>
      <div className="text-right text-sm">
        <p className={`${tierAccent} font-mono`}>
          ¥{formatPrice(p.priceExTax)}{" "}
          <span className="text-xs text-slate-500">税抜</span>
        </p>
        <p className="text-slate-400 font-mono text-xs">
          ¥{formatPrice(p.priceIncTax)} 税込
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`qty-${p.id}`} className="text-xs text-slate-400">
          数量
        </label>
        <input
          id={`qty-${p.id}`}
          type="number"
          min="0"
          max="99"
          value={quantities[p.id] ?? 0}
          onChange={(e) => handleQty(p.id, e.target.value)}
          className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-center font-mono"
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className={`text-lg font-bold ${tierAccent} mb-4`}>
          {tierLabel}価格表 / 製品セット
        </h2>
        <div className="space-y-4">{products.map(renderRow)}</div>
      </section>

      {options.length > 0 && (
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <h2 className={`text-lg font-bold ${tierAccent} mb-4`}>
            オプション部品
          </h2>
          <div className="space-y-4">{options.map(renderRow)}</div>
        </section>
      )}

      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-300">合計（税込）</span>
          <span className={`text-2xl ${tierAccent} font-black font-mono`}>
            ¥{formatPrice(totalIncTax)}
          </span>
        </div>
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className={`text-lg font-bold ${tierAccent}`}>ご請求先・連絡先</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="companyName"
              className="block text-xs text-slate-400 mb-1"
            >
              会社名 <span className="text-red-400">*</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={customer.companyName}
              onChange={(e) =>
                setCustomer({ ...customer, companyName: e.target.value })
              }
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="contactName"
              className="block text-xs text-slate-400 mb-1"
            >
              ご担当者名 <span className="text-red-400">*</span>
            </label>
            <input
              id="contactName"
              type="text"
              value={customer.contactName}
              onChange={(e) =>
                setCustomer({ ...customer, contactName: e.target.value })
              }
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-xs text-slate-400 mb-1"
            >
              メールアドレス <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={customer.email}
              onChange={(e) =>
                setCustomer({ ...customer, email: e.target.value })
              }
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-xs text-slate-400 mb-1"
            >
              電話番号 <span className="text-red-400">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({ ...customer, phone: e.target.value })
              }
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="postalCode"
              className="block text-xs text-slate-400 mb-1"
            >
              郵便番号 <span className="text-red-400">*</span>
            </label>
            <input
              id="postalCode"
              type="text"
              value={customer.postalCode}
              onChange={(e) =>
                setCustomer({ ...customer, postalCode: e.target.value })
              }
              required
              placeholder="000-0000"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="address"
              className="block text-xs text-slate-400 mb-1"
            >
              納品先住所 <span className="text-red-400">*</span>
            </label>
            <input
              id="address"
              type="text"
              value={customer.address}
              onChange={(e) =>
                setCustomer({ ...customer, address: e.target.value })
              }
              required
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="notes"
              className="block text-xs text-slate-400 mb-1"
            >
              備考
            </label>
            <textarea
              id="notes"
              rows={2}
              value={customer.notes}
              onChange={(e) =>
                setCustomer({ ...customer, notes: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          適格請求書（登録番号 T2810703528253）はご注文後、入金完了時にメールで自動送付されます。
        </p>
      </section>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-4 rounded-xl ${
          tier === "distributor"
            ? "bg-amber-600 hover:bg-amber-500"
            : "bg-emerald-600 hover:bg-emerald-500"
        } text-white font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isSubmitting ? "決済セッション生成中…" : "決済へ進む"}
      </button>
    </form>
  );
}
