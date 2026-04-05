"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface FormState {
  amount: string;
  description: string;
  name: string;
  email: string;
  phone: string;
}

const INITIAL_FORM: FormState = {
  amount: "",
  description: "",
  name: "",
  email: "",
  phone: "",
};

export default function PayPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedAmount = parseInt(form.amount, 10);
  const isValidAmount =
    !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 10_000_000;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const isPhoneValid = /^[\d-]{10,}$/.test(form.phone.replace(/\s/g, ""));

  const isFormValid =
    isValidAmount &&
    form.description.trim().length > 0 &&
    form.name.trim().length > 0 &&
    isEmailValid &&
    isPhoneValid;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/custom-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          description: form.description.trim(),
          customer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "決済の開始に失敗しました");
      }

      window.location.href = data.url;
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
      setIsSubmitting(false);
    }
  }

  const formatAmount = (value: string): string => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return "";
    return num.toLocaleString("ja-JP");
  };

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-black text-white mb-2 text-center">
            お支払い
          </h1>
          <p className="text-slate-400 text-center mb-8">
            金額を入力してクレジットカードまたは銀行振込でお支払いいただけます
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 金額入力 */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                お支払い金額（税込・円）
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-semibold">
                  ¥
                </span>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="0"
                  min={1}
                  max={10000000}
                  step={1}
                  required
                  className="w-full pl-10 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-2xl font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {form.amount && isValidAmount && (
                <p className="mt-2 text-emerald-400 text-sm font-semibold">
                  ¥{formatAmount(form.amount)}
                </p>
              )}
              {form.amount && !isValidAmount && (
                <p className="mt-2 text-red-400 text-sm">
                  1円〜10,000,000円の範囲で入力してください
                </p>
              )}
            </div>

            {/* 摘要・メモ */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                お支払い内容（摘要）
              </label>
              <input
                type="text"
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="例: e-steer取付工賃、出張修理代"
                required
                maxLength={200}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              />
            </div>

            {/* 区切り線 */}
            <div className="border-t border-slate-700/50" />

            {/* お客様情報 */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4">
                お客様情報
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-slate-300 mb-1"
                  >
                    お名前
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="山田 太郎"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-slate-300 mb-1"
                  >
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  />
                  {form.email && !isEmailValid && (
                    <p className="mt-1 text-red-400 text-sm">
                      有効なメールアドレスを入力してください
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-semibold text-slate-300 mb-1"
                  >
                    電話番号
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="080-1234-5678"
                    required
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  />
                  {form.phone && !isPhoneValid && (
                    <p className="mt-1 text-red-400 text-sm">
                      有効な電話番号を入力してください
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* エラー表示 */}
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
                {submitError}
              </div>
            )}

            {/* 確認表示 */}
            {isFormValid && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">
                  お支払い内容の確認
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">金額</dt>
                    <dd className="text-white font-bold text-lg">
                      ¥{formatAmount(form.amount)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">内容</dt>
                    <dd className="text-white">{form.description}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">お名前</dt>
                    <dd className="text-white">{form.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">メール</dt>
                    <dd className="text-white">{form.email}</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0f1e] disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  決済ページへ移動中...
                </span>
              ) : (
                "お支払いへ進む"
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              Stripeの安全な決済ページへ遷移します。
              <br />
              クレジットカードまたは銀行振込をお選びいただけます。
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
