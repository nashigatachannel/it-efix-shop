"use client";

import { useMemo, useRef, useState } from "react";
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
import {
  calcInstallationDiscount,
  getInstallationFeeIncTax,
  hasInstallationService,
} from "@/lib/installation";

// --- 型定義 ---

interface CustomerInfo {
  name: string;
  postalCode: string;
  prefecture: string;
  addressDetail: string;
  deliveryAddressDifferent: boolean;
  deliveryPostalCode: string;
  deliveryPrefecture: string;
  deliveryAddressDetail: string;
  phone: string;
  email: string;
  machineType: string;
  machineTypeOther: string;
  machineMaker: string;
  machineMakerOther: string;
  machineModel: string;
  notes: string;
  requestInvoice: boolean;
}

interface InstallationOptions {
  selfInstall: boolean;
  desiredDate1: string;
  desiredDate2: string;
  desiredDate3: string;
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

interface PostalAddressLookupResult {
  prefecture: string;
  addressDetail: string;
}

const EMPTY_CUSTOMER: CustomerInfo = {
  name: "",
  postalCode: "",
  prefecture: "",
  addressDetail: "",
  deliveryAddressDifferent: false,
  deliveryPostalCode: "",
  deliveryPrefecture: "",
  deliveryAddressDetail: "",
  phone: "",
  email: "",
  machineType: "",
  machineTypeOther: "",
  machineMaker: "",
  machineMakerOther: "",
  machineModel: "",
  notes: "",
  requestInvoice: true,
};

const EMPTY_INSTALLATION: InstallationOptions = {
  selfInstall: false,
  desiredDate1: "",
  desiredDate2: "",
  desiredDate3: "",
};

const EMPTY_AGREEMENT: AgreementState = {
  legalCheck: false,
  cancelCheck: false,
  taxCheck: false,
};

const MAX_QUANTITY = 99;
const OTHER_OPTION = "その他";
const MACHINE_TYPES = ["トラクター", "コンバイン", "田植え機", OTHER_OPTION] as const;
const MACHINE_MAKERS = [
  "クボタ",
  "イセキ",
  "ヤンマー",
  "NH",
  "CASE",
  "JD",
  "MF",
  "クラース",
  OTHER_OPTION,
] as const;

// 47都道府県（北海道を先頭に）。注文可能な都道府県は AVAILABLE_PREFECTURES で制御。
const JAPANESE_PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
  "沖縄県",
] as const;
const AVAILABLE_PREFECTURES: readonly string[] = ["北海道"];

function clampQuantity(value: number, maxQuantity = MAX_QUANTITY): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(maxQuantity, Math.floor(value));
}

function displayOtherChoice(value: string, otherValue: string): string {
  if (value !== OTHER_OPTION) return value;
  const trimmed = otherValue.trim();
  return trimmed ? `${OTHER_OPTION}（${trimmed}）` : OTHER_OPTION;
}

function addressLabel(
  postalCode: string,
  prefecture: string,
  addressDetail: string,
): string {
  return [postalCode ? `〒${postalCode}` : "", prefecture, addressDetail]
    .filter(Boolean)
    .join(" ");
}

function normalizePostalCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 7);
}

function getMaxQuantity(product: Product): number {
  if (
    typeof product.webAvailableQuantity === "number" &&
    Number.isFinite(product.webAvailableQuantity)
  ) {
    return Math.max(0, Math.min(MAX_QUANTITY, Math.floor(product.webAvailableQuantity)));
  }
  return MAX_QUANTITY;
}

function getQuantity(
  quantities: ProductQuantities,
  product: Product,
): number {
  return clampQuantity(quantities[product.id] ?? 0, getMaxQuantity(product));
}

function buildOrderLines(
  products: Product[],
  quantities: ProductQuantities,
): OrderLineItem[] {
  return products.map((product) => {
    const quantity = getQuantity(quantities, product);
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

function hasInstallationEligibleLine(lines: OrderLineItem[]): boolean {
  return lines.some((line) => hasInstallationService(line.product.id));
}

function tomorrowJstISO(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 + 24) * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function maxDesiredDateISO(): string {
  // 翌日から90日後まで選択可能
  const now = new Date();
  const future = new Date(now.getTime() + (9 + 24 * 90) * 60 * 60 * 1000);
  return future.toISOString().slice(0, 10);
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
  maxQuantity,
  onChange,
}: {
  productId: ProductId;
  quantity: number;
  maxQuantity: number;
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
        max={maxQuantity}
        value={quantity}
        onChange={(e) => onChange(productId, Number(e.target.value))}
        onBlur={(e) => onChange(productId, Number(e.target.value))}
        className="h-10 w-16 rounded-lg border border-[#d8c9aa] bg-white text-center font-mono text-base font-bold text-[#26322f] focus:border-[#0b806b] focus:outline-none focus:ring-2 focus:ring-[#0b806b]/20"
      />
      <button
        type="button"
        onClick={() => onChange(productId, quantity + 1)}
        disabled={quantity >= maxQuantity}
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
  const maxQuantity = getMaxQuantity(product);
  const installationFee = hasInstallationService(product.id)
    ? getInstallationFeeIncTax(product.id)
    : 0;

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
            {maxQuantity < MAX_QUANTITY && (
              <p className="mt-1 text-[10px] font-bold text-[#b58a36]">
                残り {maxQuantity}
              </p>
            )}
            {installationFee > 0 && (
              <p className="mt-1 text-[10px] text-[#88928d]">
                取付サービス込み
              </p>
            )}
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
            maxQuantity={maxQuantity}
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

function InstallationOptOutCard({
  lines,
  selfInstall,
  onToggle,
}: {
  lines: OrderLineItem[];
  selfInstall: boolean;
  onToggle: (next: boolean) => void;
}) {
  const eligibleLines = lines.filter((line) =>
    hasInstallationService(line.product.id),
  );
  if (eligibleLines.length === 0) return null;

  const { totalDiscount, lineBreakdown } = calcInstallationDiscount(
    eligibleLines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    true,
  );

  return (
    <div className="mb-8 rounded-xl border border-[#eadfce] bg-white p-5">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={selfInstall}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-[#d8c9aa] bg-white text-[#0b806b] focus:ring-2 focus:ring-[#0b806b]/30"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#26322f]">
            取付サービスは不要(自分で取付する)
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#607069]">
            本体価格には現地への取付サービスが標準で含まれています。
            ご自身で取付される場合はこのチェックを入れると、取付サービス分が割引されます。
          </p>
          <ul className="mt-3 space-y-1 text-xs text-[#394842]">
            {lineBreakdown.map((line) => {
              const product = eligibleLines.find(
                (l) => l.product.id === line.productId,
              )?.product;
              return (
                <li key={line.productId} className="flex justify-between gap-3">
                  <span>
                    {product?.name ?? line.productId} × {line.quantity}
                  </span>
                  <span className="font-mono">
                    -¥{formatPrice(line.lineDiscount)}
                  </span>
                </li>
              );
            })}
          </ul>
          {selfInstall && (
            <>
              <p className="mt-3 text-sm font-bold text-[#b58a36]">
                取付サービス割引: -¥{formatPrice(totalDiscount)}(税込)
              </p>
              <div className="mt-3 rounded-lg border border-[#f0e1c3] bg-[#fbf3e0] p-3 text-xs leading-relaxed text-[#7a5b1d]">
                <p className="font-semibold">取付サービス不要を選択した場合のご注意</p>
                <ul className="mt-1 list-disc pl-4">
                  <li>ブラケットの型番は別途お問い合わせください</li>
                  <li>自社取付に起因するトラブルは保証対象外となります</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </label>
    </div>
  );
}

function Step1Products({
  mainProducts,
  optionProducts,
  donationProducts,
  quantities,
  onQuantityChange,
  selfInstall,
  onSelfInstallToggle,
  onNext,
}: {
  mainProducts: Product[];
  optionProducts: Product[];
  donationProducts: Product[];
  quantities: ProductQuantities;
  onQuantityChange: (id: ProductId, quantity: number) => void;
  selfInstall: boolean;
  onSelfInstallToggle: (next: boolean) => void;
  onNext: () => void;
}) {
  const orderProducts = [...mainProducts, ...optionProducts, ...donationProducts];
  const lines = buildOrderLines(orderProducts, quantities);
  const subtotal = calcLinesTotal(lines);
  const { totalDiscount } = calcInstallationDiscount(
    lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    selfInstall,
  );
  const adjustedTotal = subtotal - totalDiscount;
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
          {mainProducts.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product)}
              onQuantityChange={onQuantityChange}
              imageColumnClass="sm:grid-cols-[180px_1fr]"
            />
          ))}
        </div>
      </fieldset>

      {/* 取付サービス不要オプション(本体製品が選択されているときのみ) */}
      <InstallationOptOutCard
        lines={lines}
        selfInstall={selfInstall}
        onToggle={onSelfInstallToggle}
      />

      {/* オプション */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-[#394842] mb-4">
          オプション
          <span className="text-xs text-[#88928d] font-normal ml-2">複数選択可</span>
        </legend>
        <div className="flex flex-col gap-3">
          {optionProducts.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product)}
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
          {donationProducts.map((product) => (
            <ProductQuantityCard
              key={product.id}
              product={product}
              quantity={getQuantity(quantities, product)}
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
          <span className="text-xl font-black text-[#26322f]">
            ¥{formatPrice(subtotal)}
          </span>
        </div>
        {totalDiscount > 0 && (
          <div className="mt-2 flex justify-between items-center text-sm">
            <span className="text-[#b58a36]">取付サービス割引</span>
            <span className="font-mono text-[#b58a36]">
              -¥{formatPrice(totalDiscount)}
            </span>
          </div>
        )}
        {totalDiscount > 0 && (
          <div className="mt-3 flex justify-between items-center border-t border-[#eadfce] pt-3">
            <span className="text-[#394842] font-medium">お支払合計</span>
            <span className="text-2xl font-black text-[#0b806b]">
              ¥{formatPrice(adjustedTotal)}
            </span>
          </div>
        )}
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
  selfInstall,
  onBack,
  onNext,
}: {
  lines: OrderLineItem[];
  selfInstall: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const subtotal = calcLinesTotal(lines);
  const { totalDiscount } = calcInstallationDiscount(
    lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    selfInstall,
  );
  const total = subtotal - totalDiscount;

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
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[#394842]">小計（税込）</span>
          <span className="font-mono text-[#26322f]">
            ¥{formatPrice(subtotal)}
          </span>
        </div>
        {totalDiscount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-4 text-sm">
            <span className="text-[#b58a36]">取付サービス割引</span>
            <span className="font-mono text-[#b58a36]">
              -¥{formatPrice(totalDiscount)}
            </span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#eadfce] pt-3">
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
  installation,
  needsDesiredDates,
  onCustomerChange,
  onInstallationChange,
  onBack,
  onNext,
}: {
  customer: CustomerInfo;
  installation: InstallationOptions;
  needsDesiredDates: boolean;
  onCustomerChange: (field: keyof CustomerInfo, value: string | boolean) => void;
  onInstallationChange: (
    field: keyof InstallationOptions,
    value: string | boolean,
  ) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  type CustomerErrorKey =
    | keyof CustomerInfo
    | "desiredDate1"
    | "desiredDate2"
    | "desiredDate3";

  const [errors, setErrors] = useState<Partial<Record<CustomerErrorKey, string>>>(
    {},
  );

  const requiredCustomerFields: (keyof CustomerInfo)[] = [
    "name",
    "postalCode",
    "prefecture",
    "addressDetail",
    "phone",
    "email",
    "machineType",
    "machineMaker",
  ];

  const minDesiredDate = tomorrowJstISO();
  const maxDesiredDate = maxDesiredDateISO();

  const validate = (): boolean => {
    const newErrors: Partial<Record<CustomerErrorKey, string>> = {};
    for (const field of requiredCustomerFields) {
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
    if (
      customer.prefecture &&
      !AVAILABLE_PREFECTURES.includes(customer.prefecture)
    ) {
      newErrors.prefecture =
        "現在は北海道のみ販売しております。本州・四国・九州への展開は順次拡大予定です。";
    }
    if (customer.deliveryAddressDifferent) {
      if (!customer.deliveryPostalCode.trim()) {
        newErrors.deliveryPostalCode = "入力してください";
      } else if (!/^\d{3}-?\d{4}$/.test(customer.deliveryPostalCode)) {
        newErrors.deliveryPostalCode =
          "ハイフンあり・なし両方可 (例: 123-4567)";
      }
      if (!customer.deliveryPrefecture.trim()) {
        newErrors.deliveryPrefecture = "入力してください";
      } else if (!AVAILABLE_PREFECTURES.includes(customer.deliveryPrefecture)) {
        newErrors.deliveryPrefecture =
          "現在は北海道のみ販売しております。本州・四国・九州への展開は順次拡大予定です。";
      }
      if (!customer.deliveryAddressDetail.trim()) {
        newErrors.deliveryAddressDetail = "入力してください";
      }
    }
    if (customer.machineType === OTHER_OPTION && !customer.machineTypeOther.trim()) {
      newErrors.machineTypeOther = "その他の内容を入力してください";
    }
    if (customer.machineMaker === OTHER_OPTION && !customer.machineMakerOther.trim()) {
      newErrors.machineMakerOther = "その他のメーカー名を入力してください";
    }
    if (needsDesiredDates) {
      if (!installation.desiredDate1.trim()) {
        newErrors.desiredDate1 = "第1希望日は必須です";
      }
      if (!installation.desiredDate2.trim()) {
        newErrors.desiredDate2 = "第2希望日は必須です";
      }
      for (const key of [
        "desiredDate1",
        "desiredDate2",
        "desiredDate3",
      ] as const) {
        const val = installation[key];
        if (val && val < minDesiredDate) {
          newErrors[key] = "翌日以降の日付を選択してください";
        }
        if (val && val > maxDesiredDate) {
          newErrors[key] = "90日以内の日付を選択してください";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const fieldClass = (field: CustomerErrorKey) =>
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
            onChange={(e) => onCustomerChange("name", e.target.value)}
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
            onChange={(e) => onCustomerChange("postalCode", e.target.value)}
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

        {/* 都道府県 */}
        <div>
          <label htmlFor="prefecture" className={labelClass}>
            都道府県
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="prefecture"
            value={customer.prefecture}
            onChange={(e) => onCustomerChange("prefecture", e.target.value)}
            className={`${fieldClass("prefecture")} max-w-xs`}
            aria-required="true"
            aria-describedby={errors.prefecture ? "prefecture-error" : undefined}
          >
            <option value="">選択してください</option>
            {JAPANESE_PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
          {errors.prefecture && (
            <p
              id="prefecture-error"
              className="mt-1 text-xs text-rose-400"
              role="alert"
            >
              {errors.prefecture}
            </p>
          )}
          <p className="mt-1 text-xs text-[#88928d]">
            現在は北海道のみ販売しております。本州・四国・九州への展開は順次拡大予定です。
          </p>
        </div>

        {/* 住所 */}
        <div>
          <label htmlFor="addressDetail" className={labelClass}>
            住所
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="addressDetail"
            type="text"
            autoComplete="address-line1"
            value={customer.addressDetail}
            onChange={(e) => onCustomerChange("addressDetail", e.target.value)}
            placeholder="札幌市豊平区福住一条7丁目4-13"
            className={fieldClass("addressDetail")}
            aria-required="true"
            aria-describedby={errors.addressDetail ? "addressDetail-error" : undefined}
          />
          {errors.addressDetail && (
            <p id="addressDetail-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.addressDetail}
            </p>
          )}
        </div>

        {/* 納品先住所 */}
        <div className="rounded-xl border border-[#eadfce] bg-white p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={customer.deliveryAddressDifferent}
              onChange={(e) =>
                onCustomerChange("deliveryAddressDifferent", e.target.checked)
              }
              className="mt-1 h-5 w-5 rounded border-[#d8c9aa] bg-white text-[#0b806b] focus:ring-2 focus:ring-[#0b806b]/30"
            />
            <span className="text-sm font-semibold text-[#26322f]">
              納品先の住所が異なる場合
            </span>
          </label>
          {!customer.deliveryAddressDifferent && (
            <p className="mt-2 text-xs text-[#88928d]">
              同じ場合は記載不要です。
            </p>
          )}
          {customer.deliveryAddressDifferent && (
            <div className="mt-4 grid gap-4">
              <div>
                <label htmlFor="deliveryPostalCode" className={labelClass}>
                  納品先 郵便番号
                  <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="deliveryPostalCode"
                  type="text"
                  autoComplete="shipping postal-code"
                  value={customer.deliveryPostalCode}
                  onChange={(e) =>
                    onCustomerChange("deliveryPostalCode", e.target.value)
                  }
                  placeholder="123-4567"
                  className={`${fieldClass("deliveryPostalCode")} max-w-xs`}
                  aria-required="true"
                  aria-describedby={
                    errors.deliveryPostalCode
                      ? "deliveryPostalCode-error"
                      : undefined
                  }
                />
                {errors.deliveryPostalCode && (
                  <p
                    id="deliveryPostalCode-error"
                    className="mt-1 text-xs text-rose-400"
                    role="alert"
                  >
                    {errors.deliveryPostalCode}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="deliveryPrefecture" className={labelClass}>
                  納品先 都道府県
                  <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
                </label>
                <select
                  id="deliveryPrefecture"
                  value={customer.deliveryPrefecture}
                  onChange={(e) =>
                    onCustomerChange("deliveryPrefecture", e.target.value)
                  }
                  className={`${fieldClass("deliveryPrefecture")} max-w-xs`}
                  aria-required="true"
                  aria-describedby={
                    errors.deliveryPrefecture
                      ? "deliveryPrefecture-error"
                      : undefined
                  }
                >
                  <option value="">選択してください</option>
                  {JAPANESE_PREFECTURES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>
                {errors.deliveryPrefecture && (
                  <p
                    id="deliveryPrefecture-error"
                    className="mt-1 text-xs text-rose-400"
                    role="alert"
                  >
                    {errors.deliveryPrefecture}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="deliveryAddressDetail" className={labelClass}>
                  納品先 住所
                  <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
                </label>
                <input
                  id="deliveryAddressDetail"
                  type="text"
                  autoComplete="shipping address-line1"
                  value={customer.deliveryAddressDetail}
                  onChange={(e) =>
                    onCustomerChange("deliveryAddressDetail", e.target.value)
                  }
                  placeholder="札幌市豊平区福住一条7丁目4-13"
                  className={fieldClass("deliveryAddressDetail")}
                  aria-required="true"
                  aria-describedby={
                    errors.deliveryAddressDetail
                      ? "deliveryAddressDetail-error"
                      : undefined
                  }
                />
                {errors.deliveryAddressDetail && (
                  <p
                    id="deliveryAddressDetail-error"
                    className="mt-1 text-xs text-rose-400"
                    role="alert"
                  >
                    {errors.deliveryAddressDetail}
                  </p>
                )}
              </div>
            </div>
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
            onChange={(e) => onCustomerChange("phone", e.target.value)}
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
            onChange={(e) => onCustomerChange("email", e.target.value)}
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

        {/* 農機種別 */}
        <div>
          <label htmlFor="machineType" className={labelClass}>
            農機種別
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="machineType"
            value={customer.machineType}
            onChange={(e) => onCustomerChange("machineType", e.target.value)}
            className={`${fieldClass("machineType")} max-w-sm`}
            aria-required="true"
            aria-describedby={errors.machineType ? "machineType-error" : undefined}
          >
            <option value="">選択してください</option>
            {MACHINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors.machineType && (
            <p id="machineType-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.machineType}
            </p>
          )}
          {customer.machineType === OTHER_OPTION && (
            <div className="mt-3">
              <label htmlFor="machineTypeOther" className={labelClass}>
                その他の農機種別
                <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
              </label>
              <input
                id="machineTypeOther"
                type="text"
                value={customer.machineTypeOther}
                onChange={(e) =>
                  onCustomerChange("machineTypeOther", e.target.value)
                }
                placeholder="例: 防除機"
                className={`${fieldClass("machineTypeOther")} max-w-sm`}
                aria-required="true"
                aria-describedby={
                  errors.machineTypeOther ? "machineTypeOther-error" : undefined
                }
              />
              {errors.machineTypeOther && (
                <p
                  id="machineTypeOther-error"
                  className="mt-1 text-xs text-rose-400"
                  role="alert"
                >
                  {errors.machineTypeOther}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 農機メーカー */}
        <div>
          <label htmlFor="machineMaker" className={labelClass}>
            農機メーカー
            <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="machineMaker"
            value={customer.machineMaker}
            onChange={(e) => onCustomerChange("machineMaker", e.target.value)}
            className={`${fieldClass("machineMaker")} max-w-sm`}
            aria-required="true"
            aria-describedby={errors.machineMaker ? "machineMaker-error" : undefined}
          >
            <option value="">選択してください</option>
            {MACHINE_MAKERS.map((maker) => (
              <option key={maker} value={maker}>
                {maker}
              </option>
            ))}
          </select>
          {errors.machineMaker && (
            <p id="machineMaker-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.machineMaker}
            </p>
          )}
          {customer.machineMaker === OTHER_OPTION && (
            <div className="mt-3">
              <label htmlFor="machineMakerOther" className={labelClass}>
                その他のメーカー名
                <span className="text-rose-400 ml-1" aria-hidden="true">*</span>
              </label>
              <input
                id="machineMakerOther"
                type="text"
                value={customer.machineMakerOther}
                onChange={(e) =>
                  onCustomerChange("machineMakerOther", e.target.value)
                }
                placeholder="メーカー名を入力"
                className={`${fieldClass("machineMakerOther")} max-w-sm`}
                aria-required="true"
                aria-describedby={
                  errors.machineMakerOther
                    ? "machineMakerOther-error"
                    : undefined
                }
              />
              {errors.machineMakerOther && (
                <p
                  id="machineMakerOther-error"
                  className="mt-1 text-xs text-rose-400"
                  role="alert"
                >
                  {errors.machineMakerOther}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 農機の機種名・型番 */}
        <div>
          <label htmlFor="machineModel" className={labelClass}>
            農機の機種名・型番
            <span className="text-xs text-[#88928d] font-normal ml-2">任意</span>
          </label>
          <input
            id="machineModel"
            type="text"
            value={customer.machineModel}
            onChange={(e) => onCustomerChange("machineModel", e.target.value)}
            placeholder="NW8SQZAT など"
            className={fieldClass("machineModel")}
            aria-describedby={errors.machineModel ? "machineModel-error" : undefined}
          />
          {errors.machineModel && (
            <p id="machineModel-error" className="mt-1 text-xs text-rose-400" role="alert">
              {errors.machineModel}
            </p>
          )}
        </div>

        {/* 取付サービス利用時のみ表示: 希望日 */}
        {needsDesiredDates && (
          <fieldset className="rounded-xl border border-[#eadfce] bg-[#fbf7ef] p-5">
            <legend className="px-2 text-sm font-semibold text-[#394842]">
              取付ご希望日
              <span className="text-xs text-[#88928d] font-normal ml-2">
                第1/第2希望は必須・第3希望は任意
              </span>
            </legend>
            <p className="mt-2 text-xs leading-relaxed text-[#607069]">
              ご希望日を最大3つまでお選びください。順次調整の上、確定日をご連絡します。
              翌日以降〜90日先まで選択できます。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(
                [
                  { key: "desiredDate1", label: "第1希望", required: true },
                  { key: "desiredDate2", label: "第2希望", required: true },
                  { key: "desiredDate3", label: "第3希望", required: false },
                ] as const
              ).map(({ key, label, required }) => (
                <div key={key}>
                  <label htmlFor={key} className={labelClass}>
                    {label}
                    {required && (
                      <span className="text-rose-400 ml-1" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  <input
                    id={key}
                    type="date"
                    min={minDesiredDate}
                    max={maxDesiredDate}
                    value={installation[key]}
                    onChange={(e) => onInstallationChange(key, e.target.value)}
                    className={fieldClass(key)}
                    aria-required={required ? "true" : undefined}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                  />
                  {errors[key] && (
                    <p
                      id={`${key}-error`}
                      className="mt-1 text-xs text-rose-400"
                      role="alert"
                    >
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        )}

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
            onChange={(e) => onCustomerChange("notes", e.target.value)}
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
  installation,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  lines: OrderLineItem[];
  customer: CustomerInfo;
  installation: InstallationOptions;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const subtotal = calcLinesTotal(lines);
  const { totalDiscount } = calcInstallationDiscount(
    lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    installation.selfInstall,
  );
  const total = subtotal - totalDiscount;

  const installationEligible = lines.some((l) =>
    hasInstallationService(l.product.id),
  );
  const customerAddressDisplay = addressLabel(
    customer.postalCode,
    customer.prefecture,
    customer.addressDetail,
  );
  const deliveryAddressDisplay = customer.deliveryAddressDifferent
    ? addressLabel(
        customer.deliveryPostalCode,
        customer.deliveryPrefecture,
        customer.deliveryAddressDetail,
      )
    : "基本住所と同じ";
  const machineTypeDisplay = displayOtherChoice(
    customer.machineType,
    customer.machineTypeOther,
  );
  const machineMakerDisplay = displayOtherChoice(
    customer.machineMaker,
    customer.machineMakerOther,
  );
  const machineModelDisplay = customer.machineModel.trim() || "未入力";

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
        <div className="mt-4 pt-4 border-t border-[#eadfce] space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#607069]">小計（税込）</span>
            <span className="font-mono text-[#26322f]">¥{formatPrice(subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#b58a36]">取付サービス割引</span>
              <span className="font-mono text-[#b58a36]">
                -¥{formatPrice(totalDiscount)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-[#eadfce] pt-3">
            <span className="font-bold text-[#26322f]">合計（税込）</span>
            <span className="text-2xl font-black text-[#0b806b]">
              ¥{formatPrice(total)}
            </span>
          </div>
        </div>
      </div>

      {/* 取付サービス情報 */}
      {installationEligible && (
        <div className="rounded-xl border border-[#eadfce] bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#394842] mb-4 pb-3 border-b border-[#eadfce]">
            取付サービス
          </h3>
          {installation.selfInstall ? (
            <p className="text-sm text-[#607069]">
              取付サービスは利用しません（自分で取付）。ブラケット型番は別途お問い合わせください。
            </p>
          ) : (
            <dl className="divide-y divide-[#eadfce]">
              <div className={dlItemClass}>
                <dt className={dtClass}>取付サービス</dt>
                <dd className={ddClass}>利用する（取付込み価格）</dd>
              </div>
              <div className={dlItemClass}>
                <dt className={dtClass}>第1希望</dt>
                <dd className={ddClass}>{installation.desiredDate1 || "—"}</dd>
              </div>
              {installation.desiredDate2 && (
                <div className={dlItemClass}>
                  <dt className={dtClass}>第2希望</dt>
                  <dd className={ddClass}>{installation.desiredDate2}</dd>
                </div>
              )}
              {installation.desiredDate3 && (
                <div className={dlItemClass}>
                  <dt className={dtClass}>第3希望</dt>
                  <dd className={ddClass}>{installation.desiredDate3}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

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
            <dd className={`${ddClass} max-w-xs`}>
              {customerAddressDisplay}
            </dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>納品先住所</dt>
            <dd className={`${ddClass} max-w-xs`}>
              {deliveryAddressDisplay}
            </dd>
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
            <dt className={dtClass}>農機種別</dt>
            <dd className={ddClass}>{machineTypeDisplay}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>農機メーカー</dt>
            <dd className={ddClass}>{machineMakerDisplay}</dd>
          </div>
          <div className={dlItemClass}>
            <dt className={dtClass}>機種名・型番</dt>
            <dd className={ddClass}>{machineModelDisplay}</dd>
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

interface OrderFormProps {
  mainProducts?: Product[];
  optionProducts?: Product[];
  donationProducts?: Product[];
}

export default function OrderForm({
  mainProducts = MAIN_PRODUCTS,
  optionProducts = OPTION_PRODUCTS,
  donationProducts = DONATION_PRODUCTS,
}: OrderFormProps) {
  const [step, setStep] = useState(1);
  const [quantities, setQuantities] = useState<ProductQuantities>({});
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [installation, setInstallation] = useState<InstallationOptions>(
    EMPTY_INSTALLATION,
  );
  const [agreement, setAgreement] = useState<AgreementState>(EMPTY_AGREEMENT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const postalLookupRef = useRef<
    Record<"postalCode" | "deliveryPostalCode", string>
  >({
    postalCode: "",
    deliveryPostalCode: "",
  });
  const orderProducts = useMemo(
    () => [...mainProducts, ...optionProducts, ...donationProducts],
    [mainProducts, optionProducts, donationProducts],
  );
  const lines = buildOrderLines(orderProducts, quantities);
  const installationEligible = hasInstallationEligibleLine(lines);
  const needsDesiredDates = installationEligible && !installation.selfInstall;

  const handleQuantityChange = (id: ProductId, quantity: number) => {
    const product = orderProducts.find((candidate) => candidate.id === id);
    const normalized = clampQuantity(
      quantity,
      product ? getMaxQuantity(product) : MAX_QUANTITY,
    );
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
    value: string | boolean,
  ) => {
    setCustomer((prev) => ({ ...prev, [field]: value }));
    if (typeof value !== "string") return;
    if (field === "postalCode" || field === "deliveryPostalCode") {
      void lookupPostalAddress(field, value);
    }
  };

  async function lookupPostalAddress(
    field: "postalCode" | "deliveryPostalCode",
    value: string,
  ) {
    const postalCode = normalizePostalCode(value);
    if (postalCode.length !== 7) {
      postalLookupRef.current[field] = "";
      return;
    }
    if (postalLookupRef.current[field] === postalCode) return;
    postalLookupRef.current[field] = postalCode;

    try {
      const response = await fetch(
        `/api/postal-address?zipcode=${encodeURIComponent(postalCode)}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as PostalAddressLookupResult;
      setCustomer((prev) => {
        if (field === "postalCode") {
          if (normalizePostalCode(prev.postalCode) !== postalCode) return prev;
          return {
            ...prev,
            prefecture: data.prefecture,
            addressDetail: data.addressDetail,
          };
        }
        if (normalizePostalCode(prev.deliveryPostalCode) !== postalCode) {
          return prev;
        }
        return {
          ...prev,
          deliveryPrefecture: data.prefecture,
          deliveryAddressDetail: data.addressDetail,
        };
      });
    } catch {
      postalLookupRef.current[field] = "";
    }
  }

  const handleInstallationChange = (
    field: keyof InstallationOptions,
    value: string | boolean,
  ) => {
    setInstallation((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelfInstallToggle = (next: boolean) => {
    setInstallation((prev) => ({
      ...prev,
      selfInstall: next,
      ...(next
        ? { desiredDate1: "", desiredDate2: "", desiredDate3: "" }
        : {}),
    }));
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

    const { totalDiscount } = calcInstallationDiscount(
      lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      installation.selfInstall,
    );
    const total = calcLinesTotal(lines) - totalDiscount;
    const customerAddressText = addressLabel(
      customer.postalCode,
      customer.prefecture,
      customer.addressDetail,
    );
    const deliveryAddressText = customer.deliveryAddressDifferent
      ? addressLabel(
          customer.deliveryPostalCode,
          customer.deliveryPrefecture,
          customer.deliveryAddressDetail,
        )
      : "基本住所と同じ";
    const machineTypeText = displayOtherChoice(
      customer.machineType,
      customer.machineTypeOther,
    );
    const machineMakerText = displayOtherChoice(
      customer.machineMaker,
      customer.machineMakerOther,
    );
    const machineModelText = customer.machineModel.trim() || "未入力";
    const confirmed = window.confirm(
      [
        "この内容で注文手続きへ進みますか？",
        "",
        ...lines.map(
          (line) =>
            `・${line.product.name}: ¥${formatPrice(line.unitPriceIncTax)} x ${line.quantity} = ¥${formatPrice(line.lineTotalIncTax)}`,
        ),
        ...(totalDiscount > 0
          ? [`・取付サービス割引: -¥${formatPrice(totalDiscount)}`]
          : []),
        "",
        `合計(税込): ¥${formatPrice(total)}`,
        `お名前: ${customer.name}`,
        `メール: ${customer.email}`,
        `電話: ${customer.phone}`,
        `住所: ${customerAddressText}`,
        `納品先: ${deliveryAddressText}`,
        `農機: ${machineTypeText} / ${machineMakerText} / ${machineModelText}`,
        ...(needsDesiredDates
          ? [
              `取付ご希望日: ${installation.desiredDate1}` +
                (installation.desiredDate2
                  ? ` / ${installation.desiredDate2}`
                  : "") +
                (installation.desiredDate3
                  ? ` / ${installation.desiredDate3}`
                  : ""),
            ]
          : []),
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
          installation,
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
            mainProducts={mainProducts}
            optionProducts={optionProducts}
            donationProducts={donationProducts}
            quantities={quantities}
            onQuantityChange={handleQuantityChange}
            selfInstall={installation.selfInstall}
            onSelfInstallToggle={handleSelfInstallToggle}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Cart
            lines={lines}
            selfInstall={installation.selfInstall}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <Step2Customer
            customer={customer}
            installation={installation}
            needsDesiredDates={needsDesiredDates}
            onCustomerChange={handleCustomerChange}
            onInstallationChange={handleInstallationChange}
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
            installation={installation}
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
