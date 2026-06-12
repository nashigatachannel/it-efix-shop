"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MAIN_PRODUCTS,
  OPTION_PRODUCTS,
  DONATION_PRODUCTS,
  calcTaxIncluded,
  formatPrice,
  type Product,
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
  requestInvoice: boolean;
}

interface AgreementState {
  legalCheck: boolean;
  cancelCheck: boolean;
  taxCheck: boolean;
}

type ProductQuantities = Partial<Record<ProductId, number>>;

interface OrderLineItem {
  product: Product;
  quantity: number;
  unitPriceIncTax: number;
  lineTotalIncTax: number;
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
  requestInvoice: true,
};

const EMPTY_AGREEMENT: AgreementState = {
  legalCheck: false,
  cancelCheck: false,
  taxCheck: false,
};

const MAX_QUANTITY = 99;
const ORDER_PRODUCTS: Product[] = [
  ...MAIN_PRODUCTS,
  ...OPTION_PRODUCTS,
  ...DONATION_PRODUCTS,
];

function clampQuantity(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_QUANTITY, Math.floor(value));
}

function getQuantity(quantities: ProductQuantities, id: ProductId): number {
  return clampQuantity(quantities[id] ?? 0);
}

function buildOrderLines(quantities: ProductQuantities): OrderLineItem[] {
  return ORDER_PRODUCTS.map((product) => {
    const quantity = getQuantity(quantities, product.id);
    const unitPriceIncTax = calcTaxIncluded(product.priceExTax);
    return {
      product,
      quantity,
      unitPriceIncTax,
      lineTotalIncTax: unitPriceIncTax * quantity,
    };
  }).filter((line) => line.quantity > 0);
}

function calcLinesTotal(lines: OrderLineItem[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotalIncTax, 0);
}

// --- プログレスバー ---

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ["製品選択", "カート", "お客様情報", "同意確認", "注文確認"];

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
                      ? "bg-[#0b806b] text-white"
                      : isCurrent
                      ? "bg-[#e8f6ef] border-2 border-[#0b806b] text-[#0b806b]"
                      : "bg-white border-2 border-[#d8c9aa] text-[#88928d]",
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
                    isCurrent ? "text-[#0b806b]" : isCompleted ? "text-[#0b806b]/70" : "text-[#88928d]",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-2 transition-colors",
                    isCompleted ? "bg-[#0b806b]" : "bg-[#e7dcc8]",
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

function ProductVisual({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  if (!product.image) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-lg bg-[#fbf7ef] text-xs font-bold tracking-[0.18em] text-[#88928d]",
          compact ? "h-16 w-20" : "h-36 sm:h-full",
        ].join(" ")}
      >
        E-FIX
      </div>
    );
  }

  return (
    <div
      className={[
        "relative overflow-hidden bg-white",
        compact ? "h-16 w-20 rounded-lg" : "h-40 rounded-t-xl sm:h-full sm:rounded-l-xl sm:rounded-tr-none",
      ].join(" ")}
    >
      <Image
        src={product.image}
        alt={`${product.name}の製品画像`}
        fill
        sizes={compact ? "80px" : "(min-width: 640px) 180px, 92vw"}
        className="object-contain p-3"
      />
    </div>
  );
}

function QuantityControl({
  productId,
  quantity,
  onChange,
}: {
  productId: ProductId;
  quantity: number;
  onChange: (id: ProductId, quantity: number) => void;
}) {
  const inputId = `qty-${productId}`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        数量
      </label>
      <button
        type="button"
        onClick={() => onChange(productId, quantity - 1)}
        disabled={quantity <= 0}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8c9aa] bg-white text-lg font-black text-[#394842] transition-colors hover:border-[#c49a45] disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="数量を減らす"
      >
        -
      </button>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_QUANTITY}
        value={quantity}
        onChange={(e) => onChange(productId, Number(e.target.value))}
        onBlur={(e) => onChange(productId, Number(e.target.value))}
        className="h-10 w-16 rounded-lg border border-[#d8c9aa] bg-white text-center font-mono text-base font-bold text-[#26322f] focus:border-[#0b806b] focus:outline-none focus:ring-2 focus:ring-[#0b806b]/20"
      />
      <button
        type="button"
        onClick={() => onChange(productId, quantity + 1)}
        disabled={quantity >= MAX_QUANTITY}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8c9aa] bg-white text-lg font-black text-[#394842] transition-colors hover:border-[#c49a45] disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="数量を増やす"
      >
        +
      </button>
    </div>
  );
}

function ProductQuantityCard({
  product,
  quantity,
  onQuantityChange,
  imageColumnClass,
}: {
  product: Product;
  quantity: number;
  onQuantityChange: (id: ProductId, quantity: number) => void;
  imageColumnClass: string;
}) {
  const isSelected = quantity > 0;
  const unitPriceIncTax = calcTaxIncluded(product.priceExTax);

  return (
    <div
      className={[
        "overflow-hidden rounded-xl border transition-all sm:grid",
        imageColumnClass,
        isSelected
          ? "border-[#0b806b] bg-[#e8f6ef]"
          : "border-[#eadfce] bg-white",
      ].join(" ")}
    >
      <ProductVisual product={product} />
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[#26322f]">{product.name}</h3>
            <p className="mt-2 text-sm leading-6 text-[#607069]">
              {product.description}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-black text-[#0b806b]">
              ¥{formatPrice(unitPriceIncTax)}
            </p>
            <p className="text-xs text-[#88928d]">税込 / 1点</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {product.features.map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-[#eadfce] bg-[#fbf7ef] px-3 py-1 text-xs font-semibold text-[#394842]"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfce] pt-4">
          <QuantityControl
            productId={product.id}
            quantity={quantity}
            onChange={onQuantityChange}
          />
          {quantity > 0 && (
            <p className="text-sm font-bold text-[#0b806b]">
              小計 ¥{formatPrice(unitPriceIncTax * quantity)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1Products({
  quantities,
  onQuantityChange,
  onNext,
}: {
  quantities: ProductQuantities;
  onQuantityChange: (id: ProductId, quantity: number) => void;
  onNext: () => void;
}) {
  const lines = buildOrderLines(quantities);
  const subtotal = calcLinesTotal(lines);
  const hasAnySelection = lines.length > 0;

  return (
    <section aria-labelledby="step1-heading">
      <h2 id="step1-heading" className="text-xl font-bold text-[#26322f] mb-6">
        製品・オプション選択
      </h2>

      {/* メイン製品 */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-[#394842] mb-4 flex items-center gap-2">
          本体製品
          <span className="text-xs text-[#88928d] font-normal">任意</span>
        </legend>
        <div className="flex flex-col gap-3">
          {MAIN_PRODUCTS.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product.id)}
              onQuantityChange={onQuantityChange}
              imageColumnClass="sm:grid-cols-[180px_1fr]"
            />
          ))}
        </div>
      </fieldset>

      {/* オプション */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-[#394842] mb-4">
          オプション
          <span className="text-xs text-[#88928d] font-normal ml-2">複数選択可</span>
        </legend>
        <div className="flex flex-col gap-3">
          {OPTION_PRODUCTS.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product.id)}
              onQuantityChange={onQuantityChange}
              imageColumnClass="sm:grid-cols-[150px_1fr]"
            />
          ))}
        </div>
      </fieldset>

      {/* 支援・寄付 */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-[#394842] mb-4">
          支援・寄付
          <span className="text-xs text-[#88928d] font-normal ml-2">任意</span>
        </legend>
        <div className="flex flex-col gap-3">
          {DONATION_PRODUCTS.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product.id)}
              onQuantityChange={onQuantityChange}
              imageColumnClass="sm:grid-cols-[150px_1fr]"
            />
          ))}
        </div>
      </fieldset>

      {/* 小計 */}
      <div className="rounded-xl border border-[#eadfce] bg-white p-4 mb-8">
        <div className="flex justify-between items-center">
          <span className="text-[#394842] font-medium">小計（税込）</span>
          <span className="text-2xl font-black text-[#0b806b]">
            ¥{formatPrice(subtotal)}
          </span>
        </div>
        {!hasAnySelection && (
          <p className="text-xs text-[#88928d] mt-2">数量を入力してください</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!hasAnySelection}
          className="px-8 py-3 rounded-xl font-bold text-white bg-[#0b806b] hover:bg-[#096554] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-[#0b806b] focus-visible:outline-offset-2"
        >
          次へ
        </button>
      </div>
    </section>
  );
}

// --- ステップ2: カート ---

function Step2Cart({
  lines,
  onBack,
  onNext,
}: {
  lines: OrderLineItem[];
  onBack: () => void;
  onNext: () => void;
}) {
  const total = calcLinesTotal(lines);

  return (
    <section aria-labelledby="step2-cart-heading">
      <h2 id="step2-cart-heading" className="text-xl font-bold text-[#26322f] mb-6">
        カート
      </h2>

      <div className="rounded-xl border border-[#eadfce] bg-white">
        <ul className="divide-y divide-[#eadfce]">
          {lines.map(({ product, quantity, unitPriceIncTax, lineTotalIncTax }) => (
            <li key={product.id} className="flex items-center gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <ProductVisual product={product} compact />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#26322f]">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs text-[#607069]">
                    ¥{formatPrice(unitPriceIncTax)} x {quantity}
                  </p>
                </div>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-sm font-black text-[#0b806b]">
                  ¥{formatPrice(lineTotalIncTax)}
                </p>
                <p className="text-xs text-[#88928d]">税込</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 rounded-xl border border-[#eadfce] bg-[#fbf7ef] p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="font-bold text-[#26322f]">合計（税込）</span>
          <span className="text-2xl font-black text-[#0b806b]">
            ¥{formatPrice(total)}
          </span>
        </div>
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[#d8c9aa] px-6 py-3 font-bold text-[#394842] transition-colors hover:border-[#c49a45] hover:text-[#26322f] focus-visible:outline-2 focus-visible:outline-[#c49a45] focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-xl bg-[#0b806b] px-8 py-3 font-bold text-white transition-colors hover:bg-[#096554] focus-visible:outline-2 focus-visible:outline-[#0b806b] focus-visible:outline-offset-2"
        >
          お客様情報へ
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
  onChange: (field: keyof CustomerInfo, value: string | boolean) => void;
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
      const val = customer[field];
      if (typeof val === "string" && !val.trim()) {
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
      "w-full px-4 py-2.5 rounded-lg bg-white border text-[#26322f] placeholder-[#9aa39f] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b806b]/30",
      errors[field] ? "border-rose-500" : "border-[#d8c9aa] focus:border-[#0b806b]",
    ].join(" ");

  const labelClass = "block text-sm font-medium text-[#394842] mb-1.5";

  return (
    <section aria-labelledby="step2-heading">
      <h2 id="step2-heading" className="text-xl font-bold text-[#26322f] mb-6">
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
            <span className="text-xs text-[#88928d] font-normal ml-2">任意</span>
          </label>
          <textarea
            id="notes"
            rows={4}
            value={customer.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            placeholder="ご質問・ご要望があればご記入ください"
            className="w-full px-4 py-2.5 rounded-lg bg-white border border-[#d8c9aa] text-[#26322f] placeholder-[#9aa39f] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b806b]/30 focus:border-[#0b806b] resize-y"
          />
        </div>

        {/* 適格請求書オプション */}
        <div className="rounded-xl border border-[#eadfce] bg-white p-4">
          <label
            htmlFor="requestInvoice"
            className="flex items-start gap-3 cursor-default"
          >
            <input
              type="checkbox"
              id="requestInvoice"
              checked
              disabled
              readOnly
              className="mt-1 h-5 w-5 rounded border-[#d8c9aa] bg-white text-[#0b806b] opacity-90 focus:ring-2 focus:ring-[#0b806b]/30"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#26322f]">
                適格請求書（インボイス）をStripeで自動発行します
              </div>
              <p className="mt-1 text-xs text-[#607069] leading-relaxed">
                お支払い完了後、登録番号{" "}
                <span className="font-mono text-[#394842]">
                  T2810703528253
                </span>{" "}
                入りの適格請求書PDFをご入力のメールアドレス宛に自動送信します。
              </p>
            </div>
          </label>
        </div>
      </div>

      <p className="text-xs text-[#88928d] mt-4">
        <span className="text-rose-400">*</span> は必須項目です
      </p>

      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-bold text-[#394842] border border-[#d8c9aa] hover:border-[#c49a45] hover:text-[#26322f] transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-8 py-3 rounded-xl font-bold text-white bg-[#0b806b] hover:bg-[#096554] transition-colors focus-visible:outline-2 focus-visible:outline-[#0b806b] focus-visible:outline-offset-2"
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
            className="text-[#0b806b] hover:text-[#0b806b] underline underline-offset-2"
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
      <h2 id="step3-heading" className="text-xl font-bold text-[#26322f] mb-6">
        同意確認
      </h2>

      <p className="text-sm text-[#607069] mb-6">
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
                  ? "border-[#0b806b] bg-[#e8f6ef]"
                  : "border-[#eadfce] bg-white hover:border-[#d8c9aa]",
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
                  checked ? "border-[#0b806b] bg-[#0b806b]" : "border-[#b8c2bd]",
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
              <span className="text-sm text-[#394842] leading-relaxed">{content}</span>
            </label>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl font-bold text-[#394842] border border-[#d8c9aa] hover:border-[#c49a45] hover:text-[#26322f] transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!allChecked}
          className="px-8 py-3 rounded-xl font-bold text-white bg-[#0b806b] hover:bg-[#096554] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-[#0b806b] focus-visible:outline-offset-2"
        >
          次へ
        </button>
      </div>
    </section>
  );
}

// --- ステップ4: 注文確認 ---

function Step4Confirm({
  lines,
  customer,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  lines: OrderLineItem[];
  customer: CustomerInfo;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const total = calcLinesTotal(lines);

  const dlItemClass = "flex justify-between items-start gap-4 py-2";
  const dtClass = "text-sm text-[#607069] shrink-0";
  const ddClass = "text-sm text-[#26322f] text-right";

  return (
    <section aria-labelledby="step4-heading">
      <h2 id="step4-heading" className="text-xl font-bold text-[#26322f] mb-6">
        注文内容の確認
      </h2>

      {/* 注文商品 */}
      <div className="rounded-xl border border-[#eadfce] bg-white p-5 mb-6">
        <h3 className="text-sm font-semibold text-[#394842] mb-4 pb-3 border-b border-[#eadfce]">
          ご注文商品
        </h3>
        <ul className="flex flex-col gap-3">
          {lines.map(({ product, quantity, unitPriceIncTax, lineTotalIncTax }) => (
            <li key={product.id} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <ProductVisual product={product} compact />
                <div className="min-w-0">
                  <span className="block truncate text-sm text-[#26322f]">
                    {product.name}
                  </span>
                  <span className="text-xs text-[#607069]">
                    ¥{formatPrice(unitPriceIncTax)} x {quantity}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm text-[#0b806b] font-bold">
                  ¥{formatPrice(lineTotalIncTax)}
                </span>
                <span className="text-xs text-[#88928d] ml-1">税込</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-[#eadfce] flex justify-between items-center">
          <span className="font-bold text-[#26322f]">合計（税込）</span>
          <span className="text-2xl font-black text-[#0b806b]">
            ¥{formatPrice(total)}
          </span>
        </div>
      </div>

      {/* お客様情報 */}
      <div className="rounded-xl border border-[#eadfce] bg-white p-5 mb-8">
        <h3 className="text-sm font-semibold text-[#394842] mb-4 pb-3 border-b border-[#eadfce]">
          お客様情報
        </h3>
        <dl className="divide-y divide-[#eadfce]">
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
          <div className={dlItemClass}>
            <dt className={dtClass}>適格請求書</dt>
            <dd className={ddClass}>
              発行（T2810703528253 入りPDFをStripeから自動送付）
            </dd>
          </div>
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
          className="px-6 py-3 rounded-xl font-bold text-[#394842] border border-[#d8c9aa] hover:border-[#c49a45] hover:text-[#26322f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-slate-400 focus-visible:outline-offset-2"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white bg-[#0b806b] hover:bg-[#096554] disabled:opacity-70 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-[#0b806b] focus-visible:outline-offset-2"
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
  const [quantities, setQuantities] = useState<ProductQuantities>({});
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [agreement, setAgreement] = useState<AgreementState>(EMPTY_AGREEMENT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lines = buildOrderLines(quantities);

  const handleQuantityChange = (id: ProductId, quantity: number) => {
    const normalized = clampQuantity(quantity);
    setQuantities((prev) => {
      const next = { ...prev };
      if (normalized > 0) {
        next[id] = normalized;
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const handleCustomerChange = (
    field: keyof CustomerInfo,
    value: string | boolean
  ) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleAgreementToggle = (key: keyof AgreementState) => {
    setAgreement((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (lines.length === 0) {
      setSubmitError("数量を1以上入力してください");
      setStep(1);
      return;
    }

    const total = calcLinesTotal(lines);
    const confirmed = window.confirm(
      [
        "この内容で注文手続きへ進みますか？",
        "",
        ...lines.map(
          (line) =>
            `・${line.product.name}: ¥${formatPrice(line.unitPriceIncTax)} x ${line.quantity} = ¥${formatPrice(line.lineTotalIncTax)}`,
        ),
        "",
        `合計(税込): ¥${formatPrice(total)}`,
        `お名前: ${customer.name}`,
        `メール: ${customer.email}`,
        `電話: ${customer.phone}`,
        `配送先: ${customer.postalCode} ${customer.address}`,
        "",
        "OKを押すと決済画面へ進みます。",
      ].join("\n"),
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          customer,
          requestInvoice: true,
        }),
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

      <div className="rounded-lg border border-[#eadfce] bg-white p-5 shadow-[0_24px_70px_rgba(112,91,48,0.10)] sm:p-8">
        {step === 1 && (
          <Step1Products
            quantities={quantities}
            onQuantityChange={handleQuantityChange}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Cart
            lines={lines}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step2Customer
            customer={customer}
            onChange={handleCustomerChange}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step3Agreement
            agreement={agreement}
            onToggle={handleAgreementToggle}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <Step4Confirm
            lines={lines}
            customer={customer}
            onBack={() => setStep(4)}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
}

