"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MAIN_PRODUCTS,
  OPTION_PRODUCTS,
  DONATION_PRODUCTS,
  calcTaxIncluded,
  formatPrice,
  type ProductId,
} from "@/lib/products";

// --- 型定義 ---

interface CustomerInfo {
  name: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  machineMaker: string;
  machineModel: string;
  notes: string;
}

interface AgreementState {
  legalCheck: boolean;
  cancelCheck: boolean;
  taxCheck: boolean;
}

const EMPTY_CUSTOMER: CustomerInfo = {
  name: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  machineMaker: "",
  machineModel: "",
  notes: "",
};

const EMPTY_AGREEMENT: AgreementState = {
  legalCheck: false,
  cancelCheck: false,
  taxCheck: false,
};

// --- プログレスバー ---

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ["製品選択", "お客様情報", "同意確認", "注文確認"];

  return (
    <nav aria-label="注文ステップ" className="mb-10">
      <ol className="flex items-center gap-0">
        {steps.map((label, index) => {
          const stepNum = index + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <li key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                      : "bg-slate-700/50 border-2 border-slate-600 text-slate-500",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={[
                    "text-xs font-medium hidden sm:block",
                    isCurrent ? "text-emerald-400" : isCompleted ? "text-emerald-500/70" : "text-slate-500",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-2 transition-colors",
                    isCompleted ? "bg-emerald-500" : "bg-slate-700",
                  ].join(" ")}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// --- ステップ1: 製品選択 ---

function Step1Products({
  selectedMain,
  selectedOptions,
  onMainChange,
  onOptionToggle,
  onNext,
}: {
  selectedMain: ProductId | null;
  selectedOptions: ProductId[];
  onMainChange: (id: ProductId) => void;
  onOptionToggle: (id: ProductId) => void;
  onNext: () => void;
}) {
  const subtotal = (() => {
    let total = 0;
    if (selectedMain) {
      const p = MAIN_PRODUCTS.find((p) => p.id === selectedMain);
      if (p) total += calcTaxIncluded(p.priceExTax);
    }
    for (const optId of selectedOptions) {
      const p = [...OPTION_PRODUCTS, ...DONATION_PRODUCTS].find((p) => p.id === optId);
      if (p) total += calcTaxIncluded(p.priceExTax);
    }
    return total;
  })();

  const hasAnySelection = selectedMain !== null || selectedOptions.length > 0;

  return (
    <section aria-labelledby="step1-heading">
      <h2 id="step1-heading" className="text-xl font-bold text-white mb-6">
        製品・オプション選択
      </h2>

      {/* メイン製品 */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          本体製品
          <span className="text-xs text-slate-500 font-normal">任意</span>
        </legend>
        <div className="flex flex-col gap-3">
          {MAIN_PRODUCTS.map((product) => {
            const isSelected = selectedMain === product.id;
            return (
              <label
                key={product.id}
                className={[
                  "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="main-product"
                  value={product.id}
                  checked={isSelected}
                  onChange={() => onMainChange(product.id)}
                  className="sr-only"
                />
                {/* カスタムラジオ */}
                <div
                  className={[
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-500",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-white">{product.name}</span>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-lg">
                        ¥{formatPrice(calcTaxIncluded(product.priceExTax))}
                        <span className="text-xs font-normal text-slate-400 ml-1">税込</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{product.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* オプション */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-slate-300 mb-4">
          オプション
          <span className="text-xs text-slate-500 font-normal ml-2">複数選択可</span>
        </legend>
        <div className="flex flex-col gap-3">
          {OPTION_PRODUCTS.map((product) => {
            const isSelected = selectedOptions.includes(product.id);
            return (
              <label
                key={product.id}
                className={[
                  "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  value={product.id}
                  checked={isSelected}
                  onChange={() => onOptionToggle(product.id)}
                  className="sr-only"
                />
                <div
                  className={[
                    "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-500",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-white">{product.name}</span>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-lg">
                        ¥{formatPrice(calcTaxIncluded(product.priceExTax))}
                        <span className="text-xs font-normal text-slate-400 ml-1">税込</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{product.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 支援・寄付 */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-slate-300 mb-4">
          支援・寄付
          <span className="text-xs text-slate-500 font-normal ml-2">任意</span>
        </legend>
        <div className="flex flex-col gap-3">
          {DONATION_PRODUCTS.map((product) => {
            const isSelected = selectedOptions.includes(product.id);
            return (
              <label
                key={product.id}
                className={[
                  "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  value={product.id}
                  checked={isSelected}
                  onChange={() => onOptionToggle(product.id)}
                  className="sr-only"
                />
                <div
                  className={[
                    "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-slate-500",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-white">{product.name}</span>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-lg">
                        ¥{formatPrice(calcTaxIncluded(product.priceExTax))}
                        <span className="text-xs font-normal text-slate-400 ml-1">税込</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{product.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 小計 */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 mb-8">
        <div className="flex justify-between items-center">
          <span className="text-slate-300 font-medium">小計（税込）</span>
          <span className="text-2xl font-black text-emerald-400">
            ¥{formatPrice(subtotal)}
          </span>
        </div>
        {!hasAnySelection && (
          <p className="text-xs text-slate-500 mt-2">商品を選択してください</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!hasAnySelection}
          className="px-8 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2"
        >
          次へ
        </button>
      </div>
    </section>
  );
}

// --- ステップ2: お客様情報 ---

function Step2Customer({
  customer,
  onChange,
  onBack,
  onNext,
}: {
  customer: CustomerInfo;
  onChange: (field: keyof CustomerInfo, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

  const requiredFields: (keyof CustomerInfo)[] = [
    "name",
    "postalCode",
    "address",
    "phone",
    "email",
    "machineMaker",
    "machineModel",
  ];

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};
    for (const field of requiredFields) {
      if (!customer[field].trim()) {
        newErrors[field] = "入力してください";
      }
    }
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      newErrors.email = "正しいメールアドレスを入力してください";
    }
    if (customer.postalCode && !/^\d{3}-?\d{4}$/.test(customer.postalCode)) {
      newErrors.postalCode = "ハイフンあり・なし両方可 (例: 123-4567)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const fieldClass = (field: keyof CustomerInfo) =>
    [
      "w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
      errors[field] ? "border-rose-500" : "border-slate-600 focus:border-emerald-500",
    ].join(" ");

  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

  return (
    <section aria-labelledby="step2-heading">
      <h2 id="step2-heading" className="text-xl font-bold text-white mb-6">
        お客様情報
      </h2>

      <div className="flex flex-col gap-5">
        {/* 氏名 */}
        <div>
          <label htmlFor="name" className={labelClass}>
            氏名
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={customer.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="山田 太郎"
            className={fieldClass("name")}
            aria-required="true"
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* 郵便番号 */}
        <div>
          <label htmlFor="postalCode" className={labelClass}>
            郵便番号
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="postalCode"
            type="text"
            autoComplete="postal-code"
            value={customer.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
            placeholder="123-4567"
            className={`${fieldClass("postalCode")} max-w-xs`}
            aria-required="true"
            aria-describedby={errors.postalCode ? "postalCode-error" : undefined}
          />
          {errors.postalCode && (
            <p id="postalCode-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.postalCode}
            </p>
          )}
        </div>

        {/* 住所 */}
        <div>
          <label htmlFor="address" className={labelClass}>
            住所
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            value={customer.address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="東京都渋谷区〇〇 1-2-3"
            className={fieldClass("address")}
            aria-required="true"
            aria-describedby={errors.address ? "address-error" : undefined}
          />
          {errors.address && (
            <p id="address-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.address}
            </p>
          )}
        </div>

        {/* 電話番号 */}
        <div>
          <label htmlFor="phone" className={labelClass}>
            電話番号
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={customer.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="090-1234-5678"
            className={`${fieldClass("phone")} max-w-xs`}
            aria-required="true"
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <p id="phone-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.phone}
            </p>
          )}
        </div>

        {/* メールアドレス */}
        <div>
          <label htmlFor="email" className={labelClass}>
            メールアドレス
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={customer.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="example@example.com"
            className={fieldClass("email")}
            aria-required="true"
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* 農機メーカー名 */}
        <div>
          <label htmlFor="machineMaker" className={labelClass}>
            農機メーカー名
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="machineMaker"
            type="text"
            value={customer.machineMaker}
            onChange={(e) => onChange("machineMaker", e.target.value)}
            placeholder="クボタ、ヤンマー、イセキ など"
            className={fieldClass("machineMaker")}
            aria-required="true"
            aria-describedby={errors.machineMaker ? "machineMaker-error" : undefined}
          />
          {errors.machineMaker && (
            <p id="machineMaker-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.machineMaker}
            </p>
          )}
        </div>

        {/* 農機の機種名・型番 */}
        <div>
          <label htmlFor="machineModel" className={labelClass}>
            農機の機種名・型番
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="machineModel"
            type="text"
            value={customer.machineModel}
            onChange={(e) => onChange("machineModel", e.target.value)}
            placeholder="NW8SQZAT など"
            className={fieldClass("machineModel")}
            aria-required="true"
            aria-describedby={errors.machineModel ? "machineModel-error" : undefined}
          />
          {errors.machineModel && (
            <p id="machineModel-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.machineModel}
            </p>
          )}
        </div>

        {/* 備考 */}
        <div>
          <label htmlFor="notes" className={labelClass}>
            備考
            <span className="text-xs text-slate-500 font-normal ml-2">任意</span>
          </label>
          <textarea
            id="notes"
            rows={4}
            value={customer.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            placeholder="ご質問・ご要望があればご記入ください"
            className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-600 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-y"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        <span className="text-rose-400">*</span> は必須項目です
      </p>

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-8 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2"
        >
          次へ
        </button>
      </div>
    </section>
  );
}

// --- ステップ3: 同意確認 ---

function Step3Agreement({
  agreement,
  onToggle,
  onBack,
  onNext,
}: {
  agreement: AgreementState;
  onToggle: (key: keyof AgreementState) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const allChecked = agreement.legalCheck && agreement.cancelCheck && agreement.taxCheck;

  const items: {
    key: keyof AgreementState;
    content: React.ReactNode;
  }[] = [
    {
      key: "legalCheck",
      content: (
        <>
          <Link
            href="/legal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            特定商取引法に基づく表記
          </Link>
          を確認し、同意します
        </>
      ),
    },
    {
      key: "cancelCheck",
      content: "注文確定後のキャンセル・返品は原則お受けできないことを了承します",
    },
    {
      key: "taxCheck",
      content: "表示価格は消費税（10%）込みであることを確認します",
    },
  ];

  return (
    <section aria-labelledby="step3-heading">
      <h2 id="step3-heading" className="text-xl font-bold text-white mb-6">
        同意確認
      </h2>

      <p className="text-sm text-slate-400 mb-6">
        ご注文の前に以下の事項をご確認の上、チェックを入れてください。
      </p>

      <div className="flex flex-col gap-4 mb-8">
        {items.map(({ key, content }) => {
          const checked = agreement[key];
          return (
            <label
              key={key}
              className={[
                "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all",
                checked
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(key)}
                className="sr-only"
              />
              <div
                className={[
                  "mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  checked ? "border-emerald-500 bg-emerald-500" : "border-slate-500",
                ].join(" ")}
                aria-hidden="true"
              >
                {checked && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-slate-300 leading-relaxed">{content}</span>
            </label>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!allChecked}
          className="px-8 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2"
        >
          次へ
        </button>
      </div>
    </section>
  );
}

// --- ステップ4: 注文確認 ---

function Step4Confirm({
  selectedMain,
  selectedOptions,
  customer,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  selectedMain: ProductId | null;
  selectedOptions: ProductId[];
  customer: CustomerInfo;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const mainProduct = selectedMain ? MAIN_PRODUCTS.find((p) => p.id === selectedMain) : null;
  const optionProducts = selectedOptions.map(
    (id) => [...OPTION_PRODUCTS, ...DONATION_PRODUCTS].find((p) => p.id === id)!
  );

  const allProducts = [...(mainProduct ? [mainProduct] : []), ...optionProducts];
  const total = allProducts.reduce(
    (sum, p) => sum + calcTaxIncluded(p.priceExTax),
    0
  );

  const dlItemClass = "flex justify-between items-start gap-4 py-2";
  const dtClass = "text-sm text-slate-400 shrink-0";
  const ddClass = "text-sm text-slate-200 text-right";

  return (
    <section aria-labelledby="step4-heading">
      <h2 id="step4-heading" className="text-xl font-bold text-white mb-6">
        注文内容の確認
      </h2>

      {/* 注文商品 */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 pb-3 border-b border-slate-700/50">
          ご注文商品
        </h3>
        <ul className="flex flex-col gap-3">
          {allProducts.map((product) => (
            <li key={product.id} className="flex justify-between items-center gap-4">
              <span className="text-sm text-slate-200">{product.name}</span>
              <div className="text-right shrink-0">
                <span className="text-sm text-emerald-400 font-bold">
                  ¥{formatPrice(calcTaxIncluded(product.priceExTax))}
                </span>
                <span className="text-xs text-slate-500 ml-1">税込</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center">
          <span className="font-bold text-slate-200">合計（税込）</span>
          <span className="text-2xl font-black text-emerald-400">
            ¥{formatPrice(total)}
          </span>
        </div>
      </div>

      {/* お客様情報 */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 pb-3 border-b border-slate-700/50">
          お客様情報
        </h3>
        <dl className="divide-y divide-slate-700/30">
          <div className={dlItemClass}>
            <dt className={dtClass}>氏名</dt>
            <dd className={ddClass}>{customer.name}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>郵便番号</dt>
            <dd className={ddClass}>{customer.postalCode}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>住所</dt>
            <dd className={`${ddClass} max-w-xs`}>{customer.address}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>電話番号</dt>
            <dd className={ddClass}>{customer.phone}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>メールアドレス</dt>
            <dd className={`${ddClass} break-all`}>{customer.email}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>農機メーカー</dt>
            <dd className={ddClass}>{customer.machineMaker}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>機種名・型番</dt>
            <dd className={ddClass}>{customer.machineModel}</dd>
          </div>
          {customer.notes && (
            <div className={dlItemClass}>
              <dt className={dtClass}>備考</dt>
              <dd className={`${ddClass} max-w-xs whitespace-pre-wrap text-left`}>
                {customer.notes}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {submitError && (
        <div
          className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 mb-6 text-sm text-rose-400"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-6 py-3 rounded-xl font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-70 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-2"
        >
          {isSubmitting ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
              処理中...
            </>
          ) : (
            "注文を確定する"
          )}
        </button>
      </div>
    </section>
  );
}

// --- メインコンポーネント ---

export default function OrderForm() {
  const [step, setStep] = useState(1);
  const [selectedMain, setSelectedMain] = useState<ProductId | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<ProductId[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [agreement, setAgreement] = useState<AgreementState>(EMPTY_AGREEMENT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleOptionToggle = (id: ProductId) => {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  const handleCustomerChange = (field: keyof CustomerInfo, value: string) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleAgreementToggle = (key: keyof AgreementState) => {
    setAgreement((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const productIds: ProductId[] = [...(selectedMain ? [selectedMain] : []), ...selectedOptions];
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds, customer }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "エラーが発生しました");
      }

      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("決済URLの取得に失敗しました");
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "予期せぬエラーが発生しました。時間をおいて再度お試しください。"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <StepIndicator currentStep={step} />

      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 sm:p-8">
        {step === 1 && (
          <Step1Products
            selectedMain={selectedMain}
            selectedOptions={selectedOptions}
            onMainChange={(id) => setSelectedMain(id)}
            onOptionToggle={handleOptionToggle}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Customer
            customer={customer}
            onChange={handleCustomerChange}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step3Agreement
            agreement={agreement}
            onToggle={handleAgreementToggle}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4Confirm
            selectedMain={selectedMain}
            selectedOptions={selectedOptions}
            customer={customer}
            onBack={() => setStep(3)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
}
