"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ALL_PRODUCTS,
  calcTaxIncluded,
  formatPrice,
  type Product,
} from "@/lib/products";

interface LineItem {
  id: string;
  name: string;
  unitAmount: number;
  quantity: number;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface CheckoutResponse {
  url: string;
  total: number;
  summary: string;
}

const MAX_LINE_ITEMS = 20;
const MAX_TOTAL = 10_000_000;

const EMPTY_CUSTOMER: CustomerInfo = {
  name: "",
  email: "",
  phone: "",
};

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeItemFromProduct(product: Product): LineItem {
  return {
    id: generateId(),
    name: product.name,
    unitAmount: calcTaxIncluded(product.priceExTax),
    quantity: 1,
  };
}

function makeBlankItem(): LineItem {
  return {
    id: generateId(),
    name: "",
    unitAmount: 0,
    quantity: 1,
  };
}

export default function PayPage() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [requestInvoice] = useState(true);
  const [presetId, setPresetId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedTotal, setGeneratedTotal] = useState<number | null>(null);
  const [copyHint, setCopyHint] = useState<string>("");

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0),
    [items]
  );

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
  const isPhoneValid = /^[\d-]{10,}$/.test(customer.phone.replace(/\s/g, ""));
  const itemsValid =
    items.length > 0 &&
    items.every(
      (item) =>
        item.name.trim().length > 0 &&
        Number.isInteger(item.unitAmount) &&
        item.unitAmount >= 1 &&
        item.unitAmount <= MAX_TOTAL &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 999
    );
  const totalValid = total >= 1 && total <= MAX_TOTAL;

  const isFormValid =
    itemsValid &&
    totalValid &&
    customer.name.trim().length > 0 &&
    isEmailValid &&
    isPhoneValid;

  function addPreset() {
    if (!presetId) return;
    const product = ALL_PRODUCTS.find((p) => p.id === presetId);
    if (!product) return;
    if (items.length >= MAX_LINE_ITEMS) return;
    setItems((prev) => [...prev, makeItemFromProduct(product)]);
    setPresetId("");
    setGeneratedUrl(null);
  }

  function addBlank() {
    if (items.length >= MAX_LINE_ITEMS) return;
    setItems((prev) => [...prev, makeBlankItem()]);
    setGeneratedUrl(null);
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    setGeneratedUrl(null);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setGeneratedUrl(null);
  }

  function updateCustomer<K extends keyof CustomerInfo>(
    field: K,
    value: CustomerInfo[K]
  ) {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    setGeneratedUrl(null);
  }

  function resetAll() {
    setItems([]);
    setCustomer(EMPTY_CUSTOMER);
    setGeneratedUrl(null);
    setGeneratedTotal(null);
    setSubmitError(null);
    setCopyHint("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setGeneratedUrl(null);

    try {
      const res = await fetch("/api/custom-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: items.map((item) => ({
            name: item.name.trim(),
            unitAmount: item.unitAmount,
            quantity: item.quantity,
          })),
          customer: {
            name: customer.name.trim(),
            email: customer.email.trim(),
            phone: customer.phone.trim(),
          },
          requestInvoice: true,
        }),
      });

      const data = (await res.json()) as Partial<CheckoutResponse> & {
        error?: string;
      };

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "決済URLの生成に失敗しました");
      }

      setGeneratedUrl(data.url);
      setGeneratedTotal(data.total ?? total);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
    } finally {
      setIsSubmitting(false);
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

  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-black text-white mb-2">
          営業向けカスタム決済URL生成
        </h1>
        <p className="text-slate-400 mb-8 text-sm">
          顧客向けの個別見積もりを作成し、Stripe決済URLを生成します。
          生成URLをLINE/メールで送付してください。
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 顧客情報 */}
          <section className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-bold text-white">顧客情報</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="customer-name"
                  className="block text-xs font-semibold text-slate-300 mb-1"
                >
                  お名前 *
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={customer.name}
                  onChange={(e) => updateCustomer("name", e.target.value)}
                  placeholder="山田 太郎"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label
                  htmlFor="customer-phone"
                  className="block text-xs font-semibold text-slate-300 mb-1"
                >
                  電話番号 *
                </label>
                <input
                  id="customer-phone"
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value)}
                  placeholder="080-1234-5678"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {customer.phone && !isPhoneValid && (
                  <p className="mt-1 text-red-400 text-xs">電話番号の形式を確認</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="customer-email"
                  className="block text-xs font-semibold text-slate-300 mb-1"
                >
                  メールアドレス *
                </label>
                <input
                  id="customer-email"
                  type="email"
                  value={customer.email}
                  onChange={(e) => updateCustomer("email", e.target.value)}
                  placeholder="example@email.com"
                  required
                  className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {customer.email && !isEmailValid && (
                  <p className="mt-1 text-red-400 text-xs">メールの形式を確認</p>
                )}
              </div>
            </div>

            <label
              htmlFor="request-invoice"
              className="flex items-start gap-3 cursor-pointer pt-2 border-t border-slate-700/40"
            >
              <input
                id="request-invoice"
                type="checkbox"
                checked={requestInvoice}
                disabled
                readOnly
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 opacity-90"
              />
              <span className="text-xs text-slate-300">
                適格請求書（インボイス T2810703528253）をStripeで自動発行する
              </span>
            </label>
          </section>

          {/* 明細 */}
          <section className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">明細</h2>
              <span className="text-xs text-slate-500">
                {items.length} / {MAX_LINE_ITEMS} 行
              </span>
            </div>

            {/* プリセット選択 */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                aria-label="商品プリセット選択"
              >
                <option value="">商品プリセットから追加…</option>
                {ALL_PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（¥{formatPrice(calcTaxIncluded(p.priceExTax))}/税込）
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addPreset}
                disabled={!presetId || items.length >= MAX_LINE_ITEMS}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                プリセット追加
              </button>
              <button
                type="button"
                onClick={addBlank}
                disabled={items.length >= MAX_LINE_ITEMS}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                自由項目を追加
              </button>
            </div>

            {/* 明細リスト */}
            {items.length === 0 && (
              <p className="text-slate-500 text-sm py-6 text-center border border-dashed border-slate-700/50 rounded-lg">
                上記から明細を追加してください
              </p>
            )}

            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-end bg-slate-900/40 rounded-lg p-3"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <label
                        htmlFor={`item-name-${item.id}`}
                        className="block text-xs text-slate-400 mb-1"
                      >
                        品目（編集可）
                      </label>
                      <input
                        id={`item-name-${item.id}`}
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, { name: e.target.value })
                        }
                        placeholder="例: e-steer 20 取付工賃"
                        required
                        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div className="col-span-7 sm:col-span-3">
                      <label
                        htmlFor={`item-unit-${item.id}`}
                        className="block text-xs text-slate-400 mb-1"
                      >
                        単価（税込）
                      </label>
                      <input
                        id={`item-unit-${item.id}`}
                        type="number"
                        value={item.unitAmount || ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            unitAmount: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        min={1}
                        max={MAX_TOTAL}
                        step={1}
                        required
                        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <label
                        htmlFor={`item-qty-${item.id}`}
                        className="block text-xs text-slate-400 mb-1"
                      >
                        数量
                      </label>
                      <input
                        id={`item-qty-${item.id}`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, {
                            quantity: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        min={1}
                        max={999}
                        step={1}
                        required
                        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`${item.name || "明細"}を削除`}
                        className="px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-800 text-red-300 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* 合計 */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-700/40">
              <span className="text-sm text-slate-400">合計（税込）</span>
              <span
                className={`text-2xl font-black ${
                  totalValid ? "text-emerald-400" : "text-red-400"
                }`}
              >
                ¥{formatPrice(total)}
              </span>
            </div>
            {!totalValid && total > MAX_TOTAL && (
              <p className="text-red-400 text-xs">
                合計は1〜10,000,000円の範囲でお願いします
              </p>
            )}
          </section>

          {/* エラー表示 */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
              {submitError}
            </div>
          )}

          {/* アクション */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="flex-1 py-4 rounded-xl font-bold text-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "生成中…" : "決済URLを生成"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="px-6 py-4 rounded-xl font-bold text-base bg-slate-700 hover:bg-slate-600 text-slate-200"
            >
              リセット
            </button>
          </div>
        </form>

        {/* 生成済みURL表示 */}
        {generatedUrl && (
          <section className="mt-10 bg-emerald-900/20 border border-emerald-500/40 rounded-xl p-6 space-y-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-emerald-300">
                ✅ 決済URL生成完了
              </h2>
              {generatedTotal != null && (
                <span className="text-sm text-emerald-400 font-mono">
                  合計 ¥{formatPrice(generatedTotal)}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-300 mb-2">
                顧客送付用URL（LINE/メールで貼り付け）
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedUrl}
                  readOnly
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-3 py-2 bg-slate-900/80 border border-emerald-700/40 rounded-lg text-emerald-200 text-xs font-mono"
                  aria-label="生成された決済URL"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedUrl)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold whitespace-nowrap"
                >
                  コピー
                </button>
              </div>
              {copyHint && (
                <p className="mt-2 text-xs text-emerald-400">{copyHint}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="bg-white p-3 rounded-lg shrink-0">
                <QRCodeSVG value={generatedUrl} size={160} level="M" />
              </div>
              <div className="text-xs text-slate-300 leading-relaxed space-y-2">
                <p>
                  顧客の前で決済する場合は、左のQRコードをスマホで読み取ってもらってください。
                </p>
                <p>
                  生成されたURLには有効期限があります（カード決済は約24時間、銀行振込は7日間）。
                </p>
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-emerald-300 hover:text-emerald-200 underline"
                >
                  別タブで開いて動作確認 →
                </a>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
