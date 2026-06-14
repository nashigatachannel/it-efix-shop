"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatYen,
  type WholesaleCatalogItem,
  type WholesaleImageAsset,
} from "@/lib/wholesale-catalog";

interface CustomerInput {
  contactName: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  desiredDeliveryDate: string;
  paymentTerms: string;
  notes: string;
}

interface WholesalePageConfig {
  pageKey: "current" | "legacy";
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  companionHref: string;
  companionLabel: string;
  currentHref?: string;
  legacyHref?: string;
  priceLabel?: string;
  priceHeadingLabel?: string;
}

interface WholesaleOrderClientProps {
  heroImage: string;
  mainItems: WholesaleCatalogItem[];
  optionItems: WholesaleCatalogItem[];
  imageAssets: WholesaleImageAsset[];
  pageConfig: WholesalePageConfig;
  partnerCompanyName: string;
  partnerDefaults: Pick<
    CustomerInput,
    "contactName" | "email" | "phone" | "postalCode" | "address"
  >;
}

interface SubmitResult {
  ok?: boolean;
  saved?: boolean;
  orderId?: string;
  message?: string;
  error?: string;
}

interface CancelOrderResult {
  ok?: boolean;
  orderId?: string;
  canceledAt?: string;
  message?: string;
  error?: string;
}

interface ProfileSaveResult {
  ok?: boolean;
  message?: string;
  error?: string;
}

interface OrderHistoryLine {
  itemId: string;
  kind: WholesaleCatalogItem["kind"];
  shortName: string;
  model: string;
  category: string;
  quantity: number;
  unitPriceExTax: number;
  subtotalExTax: number;
}

interface OrderHistoryRecord {
  id: string;
  createdAt: string;
  pageKey: WholesalePageConfig["pageKey"];
  pageLabel: string;
  companyName: string;
  contactName: string;
  lineCount: number;
  setUnitCount: number;
  partUnitCount: number;
  subtotalExTax: number;
  tax: number;
  totalIncTax: number;
  lines: OrderHistoryLine[];
  status?: "active" | "canceled";
  canceledAt?: string;
}

const CANCEL_WINDOW_MS = 60 * 60 * 1000;
const EMPTY_CUSTOMER: CustomerInput = {
  contactName: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  desiredDeliveryDate: "受注後に自動調整",
  paymentTerms: "月末締め翌月末払い",
  notes: "",
};

const HISTORY_STORAGE_KEY = "efix-wholesale-order-history-v1";
const ACCESSORY_PARENT_IDS: Record<string, string[]> = {
  "part-065-4109020156": [
    "part-054-4090040071",
    "part-055-4090040069",
  ],
  "part-127-kmp-021-1": ["part-126-kmp-024"],
  "part-128-kmp-021": ["part-126-kmp-024"],
  "part-129-kmp-022": ["part-126-kmp-024"],
  "part-134-kmp-020": ["part-133-kpm-002"],
  "part-136-kmp-021": ["part-135-kmp-004"],
  "part-139-kmp-003": ["part-138-kmp-002"],
  "part-142-kpm-010": ["part-141-kpm-009"],
};

function itemSearchText(item: WholesaleCatalogItem): string {
  return [
    item.shortName,
    item.model,
    item.section,
    item.category,
    item.partNumber,
    item.name,
  ]
    .join(" ")
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ja-JP"),
  );
}

function buildOrderCsv(
  lines: { item: WholesaleCatalogItem; quantity: number }[],
  customer: CustomerInput,
  partnerCompanyName: string,
): string {
  const header = [
    "会社名",
    "担当者名",
    "メール",
    "電話",
    "郵便番号",
    "納品先住所",
    "希望納期",
    "支払条件",
    "区分",
    "対応機種",
    "カテゴリ",
    "品番",
    "商品名",
    "数量",
    "単価(税抜)",
    "小計(税抜)",
    "備考",
  ];
  const rows = lines.map(({ item, quantity }) => [
    partnerCompanyName,
    customer.contactName,
    customer.email,
    customer.phone,
    customer.postalCode,
    customer.address,
    customer.desiredDeliveryDate,
    customer.paymentTerms,
    item.kind === "set" ? "本体セット" : "部品・オプション",
    item.model,
    item.category,
    item.partNumber,
    item.name,
    String(quantity),
    String(item.wholesalePriceExTax),
    String(item.wholesalePriceExTax * quantity),
    customer.notes,
  ]);
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

function clientOrderId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EFW-${yy}${mm}${dd}-${random}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function historyMonth(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function readHistory(): OrderHistoryRecord[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrderHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function isCanceled(record: OrderHistoryRecord): boolean {
  return record.status === "canceled" || Boolean(record.canceledAt);
}

function canCancelOrder(record: OrderHistoryRecord): boolean {
  if (isCanceled(record)) return false;
  const createdAt = new Date(record.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= CANCEL_WINDOW_MS;
}

function firstProductName(record: OrderHistoryRecord): string {
  return record.lines[0]?.shortName ?? "";
}

function normalizeOrderLabel(value: string): string {
  return value
    .replaceAll("特価卸発注", "注文")
    .replaceAll("卸発注", "注文")
    .replaceAll("卸注文", "注文")
    .replaceAll("御発注", "注文")
    .replaceAll("御注文", "注文")
    .replaceAll("ご注文", "注文");
}

function zeroPriceLabel(item: WholesaleCatalogItem): string | null {
  if (item.wholesalePriceExTax !== 0) return null;
  if (item.category === "ブラケット") return null;
  const text = `${item.shortName} ${item.name} ${item.partNumber}`.toLowerCase();
  if (text.includes("isobus ut")) return "単体無料";
  if (text.includes("esnav")) return "ディスプレイ付属";
  return "付属品";
}

function isPendingWholesalePrice(item: WholesaleCatalogItem): boolean {
  return item.wholesalePriceExTax === 0 && !zeroPriceLabel(item);
}

function isLinkedAccessory(item: WholesaleCatalogItem): boolean {
  const label = zeroPriceLabel(item);
  return Boolean(label && label !== "単体無料");
}

function isDisplayLinkedLicense(item: WholesaleCatalogItem): boolean {
  const text = `${item.shortName} ${item.name} ${item.partNumber}`.toLowerCase();
  return item.wholesalePriceExTax === 0 && text.includes("esnav");
}

function zeroPriceNote(item: WholesaleCatalogItem): string | null {
  const label = zeroPriceLabel(item);
  if (!label) return null;
  if (label === "単体無料") return "単体で無料";
  if (label === "ディスプレイ付属") return "ディスプレイ付属品";
  return "標準構成に含まれます";
}

function HeroTitle({ title }: { title: string }) {
  if (title === "eSteer 20 / 20MAX 注文") {
    return (
      <>
        <span className="block">eSteer 20 /</span>
        <span className="block whitespace-nowrap">20MAX</span>
        <span className="block">注文</span>
      </>
    );
  }

  return title;
}

export default function WholesaleOrderClient({
  heroImage,
  mainItems,
  optionItems,
  imageAssets,
  pageConfig,
  partnerCompanyName,
  partnerDefaults,
}: WholesaleOrderClientProps) {
  const currentHref = pageConfig.currentHref ?? "/wholesale/esteer20";
  const legacyHref = pageConfig.legacyHref ?? "/wholesale/esteer10";
  const priceLabel = pageConfig.priceLabel ?? "通常卸価格 税抜";
  const compactPriceLabel = pageConfig.priceHeadingLabel ?? "税抜卸価格";
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [modelFilter, setModelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<CustomerInput>(() => ({
    ...EMPTY_CUSTOMER,
    contactName: partnerDefaults.contactName,
    email: partnerDefaults.email,
    phone: partnerDefaults.phone,
    postalCode: partnerDefaults.postalCode,
    address: partnerDefaults.address,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [profileResult, setProfileResult] = useState<ProfileSaveResult | null>(
    null,
  );
  const [history, setHistory] = useState<OrderHistoryRecord[]>([]);
  const [historyMonthFilter, setHistoryMonthFilter] = useState("");
  const [historyProductFilter, setHistoryProductFilter] = useState("all");
  const [historySort, setHistorySort] = useState("newest");
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const allItems = useMemo(
    () => [...mainItems, ...optionItems],
    [mainItems, optionItems],
  );
  const models = useMemo(
    () => unique(optionItems.map((item) => item.model)),
    [optionItems],
  );
  const categories = useMemo(
    () =>
      unique(
        optionItems
          .filter((item) => modelFilter === "all" || item.model === modelFilter)
          .map((item) => item.category),
      ),
    [modelFilter, optionItems],
  );
  const sections = useMemo(
    () =>
      unique(
        optionItems
          .filter((item) => modelFilter === "all" || item.model === modelFilter)
          .map((item) => item.section),
      ),
    [modelFilter, optionItems],
  );

  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return optionItems.filter((item) => {
      if (modelFilter !== "all" && item.model !== modelFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (sectionFilter !== "all" && item.section !== sectionFilter) return false;
      if (q && !itemSearchText(item).includes(q)) return false;
      return true;
    });
  }, [categoryFilter, modelFilter, optionItems, search, sectionFilter]);

  const parentUnitCountFor = useCallback(
    (item: WholesaleCatalogItem): number => {
      const explicitParents = ACCESSORY_PARENT_IDS[item.id];
      if (explicitParents) {
        return explicitParents.reduce(
          (sum, parentId) => sum + (quantities[parentId] ?? 0),
          0,
        );
      }
      const model = item.model.toLowerCase().replace(/\s/g, "");
      if (model.includes("esteer10")) {
        return quantities["set-10"] ?? 0;
      }
      if (model.includes("esteer20")) {
        return (quantities["set-20"] ?? 0) + (quantities["set-20max"] ?? 0);
      }
      return mainItems.reduce((sum, parent) => sum + (quantities[parent.id] ?? 0), 0);
    },
    [mainItems, quantities],
  );

  const effectiveQuantity = useCallback(
    (item: WholesaleCatalogItem): number => {
      if (isPendingWholesalePrice(item)) return 0;
      if (!isLinkedAccessory(item)) return quantities[item.id] ?? 0;
      return parentUnitCountFor(item) * Math.max(1, item.requiredQty);
    },
    [parentUnitCountFor, quantities],
  );

  const lines = useMemo(
    () =>
      allItems
        .map((item) => ({ item, quantity: effectiveQuantity(item) }))
        .filter((line) => line.quantity > 0),
    [allItems, effectiveQuantity],
  );

  const subtotalExTax = lines.reduce(
    (sum, line) => sum + line.item.wholesalePriceExTax * line.quantity,
    0,
  );
  const tax = Math.round(subtotalExTax * 0.1);
  const totalIncTax = subtotalExTax + tax;
  const setUnitCount = lines
    .filter((line) => line.item.kind === "set")
    .reduce((sum, line) => sum + line.quantity, 0);
  const partUnitCount = lines
    .filter((line) => line.item.kind !== "set")
    .reduce((sum, line) => sum + line.quantity, 0);

  const historyProducts = useMemo(
    () => unique(history.flatMap((record) => record.lines.map((line) => line.shortName))),
    [history],
  );

  const visibleHistory = useMemo(() => {
    const filtered = history.filter((record) => {
      if (historyMonthFilter && historyMonth(record.createdAt) !== historyMonthFilter) {
        return false;
      }
      if (
        historyProductFilter !== "all" &&
        !record.lines.some((line) => line.shortName === historyProductFilter)
      ) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (historySort === "product") {
        return firstProductName(a).localeCompare(firstProductName(b), "ja-JP");
      }
      if (historySort === "amount") return b.totalIncTax - a.totalIncTax;
      if (historySort === "units") return b.setUnitCount - a.setUnitCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [history, historyMonthFilter, historyProductFilter, historySort]);

  const activeVisibleHistory = visibleHistory.filter((record) => !isCanceled(record));
  const historyTotalUnits = activeVisibleHistory.reduce(
    (sum, record) => sum + record.setUnitCount,
    0,
  );
  const historyTotalAmount = activeVisibleHistory.reduce(
    (sum, record) => sum + record.totalIncTax,
    0,
  );

  function setQuantity(id: string, raw: string | number) {
    const n = typeof raw === "number" ? raw : Number(raw);
    const quantity = Number.isFinite(n)
      ? Math.max(0, Math.min(99, Math.floor(n)))
      : 0;
    setQuantities((prev) => ({ ...prev, [id]: quantity }));
    setSubmitResult(null);
  }

  function changeCustomer<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setCustomer((prev) => ({ ...prev, [key]: value }));
    setSubmitResult(null);
    setProfileResult(null);
  }

  function createHistoryRecord(orderId?: string): OrderHistoryRecord {
    const recordLines = lines.map(({ item, quantity }) => ({
      itemId: item.id,
      kind: item.kind,
      shortName: item.shortName,
      model: item.model,
      category: item.category,
      quantity,
      unitPriceExTax: item.wholesalePriceExTax,
      subtotalExTax: item.wholesalePriceExTax * quantity,
    }));

    return {
      id: orderId ?? clientOrderId(),
      createdAt: new Date().toISOString(),
      pageKey: pageConfig.pageKey,
      pageLabel: normalizeOrderLabel(pageConfig.title),
      companyName: partnerCompanyName.trim() || "ログイン販売店",
      contactName: customer.contactName.trim() || "未入力",
      lineCount: recordLines.length,
      setUnitCount,
      partUnitCount,
      subtotalExTax,
      tax,
      totalIncTax,
      lines: recordLines,
      status: "active",
    };
  }

  function persistHistory(record: OrderHistoryRecord) {
    setHistory((prev) => {
      const next = [record, ...prev.filter((item) => item.id !== record.id)].slice(0, 100);
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function cancelHistoryOrder(record: OrderHistoryRecord) {
    if (!canCancelOrder(record)) {
      setSubmitResult({
        error: "この注文はキャンセル可能時間(注文後1時間以内)を過ぎています。",
      });
      return;
    }

    const confirmed = window.confirm(
      [
        "この注文をキャンセルしますか？",
        "",
        `注文番号: ${record.id}`,
        `注文日時: ${formatDateTime(record.createdAt)}`,
        `主な商品: ${firstProductName(record)}`,
        `合計(税込): ¥${formatYen(record.totalIncTax)}`,
        "",
        "OKを押すと注文ステータスをキャンセル済みに更新します。",
      ].join("\n"),
    );
    if (!confirmed) return;

    setCancellingOrderId(record.id);
    setSubmitResult(null);
    try {
      const response = await fetch(
        `/api/wholesale-orders/${encodeURIComponent(record.id)}/cancel`,
        { method: "POST" },
      );
      const data = (await response.json()) as CancelOrderResult;
      if (!response.ok) {
        setSubmitResult({
          error: data.error ?? "注文のキャンセルに失敗しました。",
        });
        return;
      }

      const canceledAt = data.canceledAt ?? new Date().toISOString();
      setHistory((prev) => {
        const next = prev.map((item) =>
          item.id === record.id
            ? { ...item, status: "canceled" as const, canceledAt }
            : item,
        );
        window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setSubmitResult({
        ok: true,
        message: data.message ?? `注文 ${record.id} をキャンセルしました。`,
      });
    } catch (error) {
      setSubmitResult({
        error:
          error instanceof Error
            ? error.message
            : "注文キャンセル中に通信エラーが発生しました。",
      });
    } finally {
      setCancellingOrderId(null);
    }
  }

  function saveCurrentToHistory() {
    if (lines.length === 0) {
      setSubmitResult({ error: "数量を1以上にした商品がありません。" });
      return;
    }
    const record = createHistoryRecord();
    persistHistory(record);
    setSubmitResult({
      ok: true,
      message: `現在の注文内容を履歴へ保存しました。保存番号: ${record.id}`,
    });
  }

  function downloadCsv() {
    const csv = buildOrderCsv(lines, customer, partnerCompanyName);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `E-FIX_注文_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyOrderText() {
    const csv = buildOrderCsv(lines, customer, partnerCompanyName);
    await navigator.clipboard.writeText(csv);
    setSubmitResult({
      ok: true,
      message: "注文内容をクリップボードにコピーしました。",
    });
  }

  async function savePartnerProfile() {
    setProfileResult(null);
    if (!customer.email.trim() || !customer.phone.trim()) {
      setProfileResult({
        error: "メールアドレスと電話番号を入力してください。",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: customer.contactName,
          email: customer.email,
          phone: customer.phone,
          postalCode: customer.postalCode,
          address: customer.address,
        }),
      });
      const data = (await response.json()) as ProfileSaveResult;
      if (!response.ok) {
        setProfileResult({ error: data.error ?? "連絡先の登録に失敗しました。" });
      } else {
        setProfileResult({
          ok: true,
          message: data.message ?? "連絡先を登録しました。",
        });
      }
    } catch (error) {
      setProfileResult({
        error: error instanceof Error ? error.message : "通信エラーが発生しました。",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitResult(null);

    if (lines.length === 0) {
      setSubmitResult({ error: "数量を1以上にした商品がありません。" });
      return;
    }
    if (
      !customer.email.trim() ||
      !customer.phone.trim()
    ) {
      setSubmitResult({
        error: "メール、電話番号を入力してください。",
      });
      return;
    }

    const confirmLines = lines
      .slice(0, 12)
      .map(
        ({ item, quantity }) =>
          `・${item.shortName} / ${item.model} / ${item.category} x ${quantity} = ¥${formatYen(
            item.wholesalePriceExTax * quantity,
          )}`,
      );
    if (lines.length > confirmLines.length) {
      confirmLines.push(`・ほか ${lines.length - confirmLines.length} 件`);
    }

    const confirmed = window.confirm(
      [
        "この内容で卸注文を送信しますか？",
        "",
        `販売店: ${partnerCompanyName}`,
        `担当者: ${customer.contactName || "未入力"}`,
        `メール: ${customer.email}`,
        `電話: ${customer.phone}`,
        `納品先: ${customer.postalCode || ""} ${customer.address || ""}`.trim(),
        `支払い条件: ${customer.paymentTerms}`,
        "",
        ...confirmLines,
        "",
        `小計(税抜): ¥${formatYen(subtotalExTax)}`,
        `消費税: ¥${formatYen(tax)}`,
        `合計(税込): ¥${formatYen(totalIncTax)}`,
        "",
        "OKを押すと注文が送信されます。",
      ].join("\n"),
    );

    if (!confirmed) {
      setSubmitResult({
        ok: true,
        saved: false,
        message: "注文送信をキャンセルしました。",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/wholesale-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            ...customer,
            companyName: partnerCompanyName,
          },
          productLine: pageConfig.title,
          items: lines.map((line) => ({
            id: line.item.id,
            quantity: line.quantity,
          })),
        }),
      });
      const data = (await response.json()) as SubmitResult;
      if (!response.ok) {
        setSubmitResult({ error: data.error ?? "注文の送信に失敗しました。" });
      } else {
        persistHistory(createHistoryRecord(data.orderId));
        setSubmitResult(data);
      }
    } catch (error) {
      setSubmitResult({
        error: error instanceof Error ? error.message : "通信エラーが発生しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderQuantity = (item: WholesaleCatalogItem) => {
    const linked = isLinkedAccessory(item);
    const pendingPrice = isPendingWholesalePrice(item);
    const locked = linked || pendingPrice;
    const quantity = effectiveQuantity(item);
    const lockedTitle = pendingPrice
      ? "卸価格確認中のため数量入力できません"
      : isDisplayLinkedLicense(item)
        ? "ディスプレイ(20/20MAX)の数量に連動します"
        : "本体セットの台数に連動します";
    const disabledClass = locked
      ? "cursor-not-allowed bg-stone-100 text-stone-400"
      : "text-stone-700 hover:bg-stone-100";
    return (
      <div
        className={`flex h-10 w-[116px] items-center overflow-hidden rounded-md border ${
          locked ? "border-stone-200 bg-stone-50" : "border-stone-300 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => setQuantity(item.id, quantity - 1)}
          disabled={locked}
          className={`grid h-10 w-9 place-items-center text-lg font-semibold ${disabledClass}`}
          aria-label={`${item.name}を減らす`}
          title={locked ? lockedTitle : undefined}
        >
          -
        </button>
        <input
          value={quantity}
          min={0}
          max={99}
          type="number"
          onChange={(event) => setQuantity(item.id, event.target.value)}
          readOnly={locked}
          className={`h-10 w-10 border-x border-stone-200 text-center text-sm font-semibold outline-none ${
            locked ? "bg-stone-50 text-stone-500" : ""
          }`}
          aria-label={`${item.name}の数量`}
          title={locked ? lockedTitle : undefined}
        />
        <button
          type="button"
          onClick={() => setQuantity(item.id, quantity + 1)}
          disabled={locked}
          className={`grid h-10 w-9 place-items-center text-lg font-semibold ${disabledClass}`}
          aria-label={`${item.name}を増やす`}
          title={locked ? lockedTitle : undefined}
        >
          +
        </button>
      </div>
    );
  };

  const renderMainItem = (item: WholesaleCatalogItem) => (
    <article
      key={item.id}
      className="grid min-h-[220px] grid-cols-1 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm md:grid-cols-[220px_1fr]"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center bg-stone-100 md:aspect-auto">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="(min-width: 768px) 220px, 100vw"
          priority={item.id === mainItems[0]?.id}
          className="object-cover"
        />
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              本体セット
            </span>
            <span className="text-xs text-stone-500">{item.model}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-stone-950">{item.name}</h2>
          <p className="mt-2 text-sm text-stone-600">
            必要な本体台数を入力してください。請求書は納品日時に合わせて別途作成します。
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500">
              {isPendingWholesalePrice(item) ? "卸価格確認中" : priceLabel}
            </p>
            <p
              className={`font-mono text-2xl font-bold ${
                isPendingWholesalePrice(item) ? "text-stone-700" : "text-emerald-700"
              }`}
            >
              {isPendingWholesalePrice(item)
                ? "要確認"
                : `¥${formatYen(item.wholesalePriceExTax)}`}
            </p>
            {item.retailPriceIncTax && (
              <p className="text-xs text-stone-500">
                希望小売 税込 ¥{formatYen(item.retailPriceIncTax)}
              </p>
            )}
          </div>
          {renderQuantity(item)}
        </div>
      </div>
    </article>
  );

  const renderOptionItem = (item: WholesaleCatalogItem) => (
    <article
      key={item.id}
      className="grid min-h-[168px] grid-cols-[112px_1fr] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm"
    >
      <div className="relative flex h-full min-h-[168px] items-center justify-center bg-stone-50">
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="112px"
          className="object-contain p-2"
        />
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-[1fr_150px_122px] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">
              {item.model}
            </span>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800">
              {item.category}
            </span>
            {item.section && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                {item.section}
              </span>
            )}
            {zeroPriceLabel(item) && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                {zeroPriceLabel(item)}
              </span>
            )}
            {isPendingWholesalePrice(item) && (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">
                価格確認中
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-bold text-stone-950 md:text-base">
            {item.shortName}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {item.partNumber || "品番未設定"} / {item.name}
          </p>
        </div>
        <div className="font-mono">
          <p className="text-xs text-stone-500">
            {isPendingWholesalePrice(item)
              ? "卸価格確認中"
              : (zeroPriceLabel(item) ?? priceLabel)}
          </p>
          <p
            className={`text-lg font-bold ${
              isPendingWholesalePrice(item) ? "text-stone-700" : "text-emerald-700"
            }`}
          >
            {isPendingWholesalePrice(item)
              ? "要確認"
              : `¥${formatYen(item.wholesalePriceExTax)}`}
          </p>
          {zeroPriceNote(item) && (
            <p className="text-xs font-semibold text-emerald-700">
              {zeroPriceNote(item)}
            </p>
          )}
          <p className="text-xs text-stone-500">必要数 {item.requiredQty}</p>
        </div>
        {renderQuantity(item)}
      </div>
    </article>
  );

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-stone-950">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black tracking-widest text-emerald-700">
              E-FIX
            </div>
            <div className="hidden border-l border-stone-300 pl-3 text-xs font-semibold text-stone-500 sm:block">
              注文サイト
            </div>
          </div>
          <nav className="flex items-center gap-2 text-xs font-bold">
            <span className="hidden text-stone-500 md:inline">
              商品 {allItems.length}件 / 画像 {imageAssets.length}点
            </span>
            <Link
              href={currentHref}
              className={`rounded-md px-3 py-2 ${
                pageConfig.pageKey === "current"
                  ? "bg-emerald-700 text-white"
                  : "border border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              20 / 20MAX
            </Link>
            <Link
              href={legacyHref}
              className={`rounded-md px-3 py-2 ${
                pageConfig.pageKey === "legacy"
                  ? "bg-emerald-700 text-white"
                  : "border border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              eSteer 10
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative min-h-[360px] overflow-hidden bg-stone-950">
        <Image
          src={heroImage}
          alt="E-FIX注文サイトのメインビジュアル"
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/88 via-stone-900/62 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.22em] text-emerald-300">
              {pageConfig.badge}
            </p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white min-[380px]:text-4xl sm:text-5xl">
              <HeroTitle title={pageConfig.title} />
            </h1>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-stone-300">本体</p>
                <p className="mt-1 text-2xl font-black text-white">{setUnitCount}</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-stone-300">部品</p>
                <p className="mt-1 text-2xl font-black text-white">{partUnitCount}</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-stone-300">税別合計</p>
                <p className="mt-1 truncate text-2xl font-black text-emerald-300">
                  ¥{formatYen(subtotalExTax)}
                </p>
              </div>
            </div>
          </div>
        </div>
        {visibleHistory.length > 0 && (
          <div className="hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-red-700">ORDER CANCEL</p>
                <h3 className="text-lg font-black">注文キャンセル</h3>
              </div>
              <p className="text-xs text-stone-500">
                注文後1時間以内の注文だけキャンセルできます。
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {visibleHistory.map((record) => {
                const canceled = isCanceled(record);
                const cancellable = canCancelOrder(record);
                return (
                  <div
                    key={`cancel-${record.id}`}
                    className="grid gap-3 rounded-md border border-stone-200 p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-stone-900">
                        {firstProductName(record) || record.id}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDateTime(record.createdAt)} / {record.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700">
                        ¥{formatYen(record.totalIncTax)}
                      </span>
                      {canceled ? (
                        <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600">
                          キャンセル済み
                        </span>
                      ) : cancellable ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                          キャンセル可
                        </span>
                      ) : (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                          1時間経過
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelHistoryOrder(record)}
                      disabled={!cancellable || cancellingOrderId === record.id}
                      className="h-9 rounded-md border border-red-300 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 disabled:hover:bg-transparent"
                    >
                      {cancellingOrderId === record.id
                        ? "処理中..."
                        : canceled
                          ? "取消済み"
                          : cancellable
                            ? "キャンセル"
                            : "期限切れ"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <form
        onSubmit={submitOrder}
        className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8"
      >
        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-700">STEP 1</p>
                <h2 className="text-2xl font-black">本体セットを選択</h2>
              </div>
              <p className="text-sm text-stone-500">{compactPriceLabel}</p>
            </div>
            <div className="grid gap-4">{mainItems.map(renderMainItem)}</div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 h-12 w-full rounded-md bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : "注文"}
            </button>
          </section>

          <details className="group">
            <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 [&::-webkit-details-marker]:hidden">
              <p className="text-sm font-bold text-emerald-700">STEP 2</p>
              <h2 className="text-2xl font-black">部品・オプションを選択</h2>
              <span className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white group-open:hidden">
                部品を表示
              </span>
              <span className="hidden rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 group-open:inline-flex">
                閉じる
              </span>
            </summary>

            <div className="hidden space-y-4 group-open:block">
            <div className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="品名・品番で検索"
                className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <select
                value={modelFilter}
                onChange={(event) => {
                  setModelFilter(event.target.value);
                  setCategoryFilter("all");
                  setSectionFilter("all");
                }}
                className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
                aria-label="対応機種"
              >
                <option value="all">対応機種すべて</option>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <select
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
                className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
                aria-label="セクション"
              >
                <option value="all">セクションすべて</option>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
                aria-label="カテゴリ"
              >
                <option value="all">カテゴリすべて</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm text-stone-500">
              <span>{visibleOptions.length}件を表示</span>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setModelFilter("all");
                  setCategoryFilter("all");
                  setSectionFilter("all");
                }}
                className="font-semibold text-emerald-700 hover:text-emerald-600"
              >
                絞り込み解除
              </button>
            </div>
            <div className="grid gap-3">{visibleOptions.map(renderOptionItem)}</div>
            </div>
          </details>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-emerald-700">確認</p>
            <h2 className="mt-1 text-xl font-black">いまの注文内容</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-stone-50 p-3">
                <p className="text-xs text-stone-500">品目</p>
                <p className="mt-1 text-xl font-black">{lines.length}</p>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <p className="text-xs text-stone-500">本体台数</p>
                <p className="mt-1 text-xl font-black">{setUnitCount}</p>
              </div>
              <div className="rounded-md bg-stone-50 p-3">
                <p className="text-xs text-stone-500">部品数量</p>
                <p className="mt-1 text-xl font-black">{partUnitCount}</p>
              </div>
            </div>
            <div className="mt-4 max-h-[260px] space-y-2 overflow-auto border-y border-stone-200 py-3">
              {lines.length === 0 ? (
                <p className="text-sm text-stone-500">
                  数量を入力すると、ここに注文予定の商品と個数が表示されます。
                </p>
              ) : (
                lines.map(({ item, quantity }) => (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.shortName}</p>
                      <p className="text-xs text-stone-500">
                        {item.model} / {item.category}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p>x {quantity}</p>
                      <p className="text-xs text-stone-500">
                        ¥{formatYen(item.wholesalePriceExTax * quantity)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">小計 税抜</span>
                <span className="font-mono">¥{formatYen(subtotalExTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">消費税 10%</span>
                <span className="font-mono">¥{formatYen(tax)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-stone-200 pt-3">
                <span className="font-bold">合計 税込</span>
                <span className="font-mono text-2xl font-black text-emerald-700">
                  ¥{formatYen(totalIncTax)}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <input
                value={customer.contactName}
                onChange={(event) => changeCustomer("contactName", event.target.value)}
                placeholder="担当者名"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                value={customer.email}
                onChange={(event) => changeCustomer("email", event.target.value)}
                required
                type="email"
                placeholder="メールアドレス"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                value={customer.phone}
                onChange={(event) => changeCustomer("phone", event.target.value)}
                required
                type="tel"
                placeholder="電話番号"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                value={customer.postalCode}
                onChange={(event) => changeCustomer("postalCode", event.target.value)}
                placeholder="郵便番号"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <input
                value={customer.address}
                onChange={(event) => changeCustomer("address", event.target.value)}
                placeholder="納品先住所"
                className="h-10 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-stone-500">
                  希望納期
                </p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">
                  {customer.desiredDeliveryDate}
                </p>
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-stone-500">
                  支払条件
                </p>
                <p className="mt-0.5 text-sm font-semibold text-stone-800">
                  {customer.paymentTerms}
                </p>
              </div>
              <textarea
                value={customer.notes}
                onChange={(event) => changeCustomer("notes", event.target.value)}
                placeholder="備考"
                rows={3}
                className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={savePartnerProfile}
                disabled={isSavingProfile}
                className="h-10 w-full rounded-md border border-emerald-500 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingProfile ? "登録中..." : "連絡先を登録"}
              </button>
            </div>

            {profileResult?.error && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {profileResult.error}
              </p>
            )}
            {profileResult?.ok && !profileResult.error && (
              <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {profileResult.message ?? "連絡先を登録しました。"}
              </p>
            )}

            {submitResult?.error && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitResult.error}
              </p>
            )}
            {submitResult?.ok && !submitResult.error && (
              <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {submitResult.saved
                  ? `受注管理表へ保存しました。受付番号: ${submitResult.orderId}`
                  : submitResult.message ?? "注文内容を作成しました。"}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 h-12 w-full rounded-md bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : "注文"}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadCsv}
                disabled={lines.length === 0}
                className="h-10 rounded-md border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                CSV保存
              </button>
              <button
                type="button"
                onClick={copyOrderText}
                disabled={lines.length === 0}
                className="h-10 rounded-md border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                内容コピー
              </button>
            </div>
            <button
              type="button"
              onClick={saveCurrentToHistory}
              disabled={lines.length === 0}
              className="mt-2 h-10 w-full rounded-md border border-emerald-700 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              この内容を履歴に保存
            </button>
          </section>
        </aside>
      </form>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-700">ORDER HISTORY</p>
            <h2 className="text-2xl font-black">注文履歴</h2>
          </div>
          <p className="text-sm text-stone-500">
            このブラウザで保存・送信した注文内容を表示します。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold text-stone-500">履歴件数</p>
            <p className="mt-1 text-2xl font-black">{visibleHistory.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold text-stone-500">合計台数</p>
            <p className="mt-1 text-2xl font-black">{historyTotalUnits}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold text-stone-500">合計金額 税込</p>
            <p className="mt-1 font-mono text-2xl font-black text-emerald-700">
              ¥{formatYen(historyTotalAmount)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 md:grid-cols-[1fr_1.4fr_1fr_auto]">
          <input
            type="month"
            value={historyMonthFilter}
            onChange={(event) => setHistoryMonthFilter(event.target.value)}
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
            aria-label="注文月で検索"
          />
          <select
            value={historyProductFilter}
            onChange={(event) => setHistoryProductFilter(event.target.value)}
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
            aria-label="製品で絞り込み"
          >
            <option value="all">製品すべて</option>
            {historyProducts.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
          <select
            value={historySort}
            onChange={(event) => setHistorySort(event.target.value)}
            className="h-10 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-emerald-500"
            aria-label="履歴の並び順"
          >
            <option value="newest">新しい順</option>
            <option value="product">製品名順</option>
            <option value="amount">金額が大きい順</option>
            <option value="units">台数が多い順</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setHistoryMonthFilter("");
              setHistoryProductFilter("all");
              setHistorySort("newest");
            }}
            className="h-10 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            解除
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {visibleHistory.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">
              まだ履歴がありません。注文内容を作ったら「この内容を履歴に保存」または送信で残せます。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-bold text-stone-500">
                  <tr>
                    <th className="px-4 py-3">日時</th>
                    <th className="px-4 py-3">ページ</th>
                    <th className="px-4 py-3">主な製品</th>
                    <th className="px-4 py-3">本体台数</th>
                    <th className="px-4 py-3">部品数量</th>
                    <th className="px-4 py-3">合計(税込)</th>
                    <th className="px-4 py-3">受付番号</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {visibleHistory.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 text-stone-600">
                        {formatDateTime(record.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {normalizeOrderLabel(record.pageLabel)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{firstProductName(record)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                          {record.lines
                            .map((line) => `${line.shortName} x${line.quantity}`)
                            .join(" / ")}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono">{record.setUnitCount}</td>
                      <td className="px-4 py-3 font-mono">{record.partUnitCount}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                        ¥{formatYen(record.totalIncTax)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-500">
                        {record.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {visibleHistory.length > 0 && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-red-700">ORDER CANCEL</p>
                <h3 className="text-lg font-black">注文キャンセル</h3>
              </div>
              <p className="text-xs text-stone-500">
                注文後1時間以内の注文だけキャンセルできます。
              </p>
            </div>
            <div className="mt-3 space-y-2">
              {visibleHistory.map((record) => {
                const canceled = isCanceled(record);
                const cancellable = canCancelOrder(record);
                return (
                  <div
                    key={`cancel-history-${record.id}`}
                    className="grid gap-3 rounded-md border border-stone-200 p-3 text-sm md:grid-cols-[1fr_auto_auto]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-stone-900">
                        {firstProductName(record) || record.id}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDateTime(record.createdAt)} / {record.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700">
                        ¥{formatYen(record.totalIncTax)}
                      </span>
                      {canceled ? (
                        <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-1 text-xs font-bold text-stone-600">
                          キャンセル済み
                        </span>
                      ) : cancellable ? (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                          キャンセル可
                        </span>
                      ) : (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                          1時間経過
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelHistoryOrder(record)}
                      disabled={!cancellable || cancellingOrderId === record.id}
                      className="h-9 rounded-md border border-red-300 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 disabled:hover:bg-transparent"
                    >
                      {cancellingOrderId === record.id
                        ? "処理中..."
                        : canceled
                          ? "取消済み"
                          : cancellable
                            ? "キャンセル"
                            : "期限切れ"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
