"use client";

import { useMemo, useState } from "react";
import {
  MAIN_PRODUCTS,
  calcTaxIncluded,
  formatPrice,
  getPriceForTier,
  type PriceTier,
  type ProductId,
} from "@/lib/products";

interface WholesaleOrderFormProps {
  tier: PriceTier;
  tierLabel: string;
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

const EMPTY_CUSTOMER: CustomerInput = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  notes: "",
};

export default function WholesaleOrderForm({
  tier,
  tierLabel,
}: WholesaleOrderFormProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<CustomerInput>(EMPTY_CUSTOMER);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedProducts = useMemo(
    () =>
      MAIN_PRODUCTS.filter((p) => getPriceForTier(p, tier) !== null).map(
        (p) => {
          const priceExTax = getPriceForTier(p, tier) ?? p.priceExTax;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            priceExTax,
            priceIncTax: calcTaxIncluded(priceExTax),
          };
        }
      ),
    [tier]
  );

  const lines = useMemo(
    () =>
      orderedProducts
        .map((p) => ({
          product: p,
          quantity: quantities[p.id] ?? 0,
        }))
        .filter((l) => l.quantity > 0),
    [orderedProducts, quantities]
  );

  const totalIncTax = lines.reduce(
    (sum, l) => sum + l.product.priceIncTax * l.quantity,
    0
  );

  const handleQtyChange = (id: string, raw: string) => {
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
      setError("数量を1台以上指定してください");
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
            productId: l.product.id as ProductId,
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
          requestInvoice: true, // 卸取引は基本適格請求書発行
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-lg font-bold text-emerald-400 mb-4">
          {tierLabel}価格表 / 数量入力
        </h2>
        <div className="space-y-4">
          {orderedProducts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/40 border border-slate-800 rounded-lg p-4"
            >
              <div className="flex-1">
                <p className="text-white font-bold">{p.name}</p>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-emerald-300 font-mono">
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
                  onChange={(e) => handleQtyChange(p.id, e.target.value)}
                  className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-center font-mono"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-baseline justify-between">
          <span className="text-slate-300">合計（税込）</span>
          <span className="text-2xl text-emerald-400 font-black font-mono">
            ¥{formatPrice(totalIncTax)}
          </span>
        </div>
      </section>

      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-emerald-400 mb-2">
          ご請求先・連絡先
        </h2>
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
          適格請求書（登録番号 T2810703528253）はご注文後にメールで自動送付されます。
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
        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "決済セッション生成中…" : "決済へ進む"}
      </button>
    </form>
  );
}
