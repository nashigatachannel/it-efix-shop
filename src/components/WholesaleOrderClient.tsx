"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatYen,
  isHottaBracketItem,
  isHottaPricePendingItem,
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
  machineModel: string;
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
  pricePending?: boolean;
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

interface SetDetailLine {
  partNumber: string;
  name: string;
  quantity: string;
  note?: string;
}

interface SetDetailGroup {
  id: string;
  title: string;
  partNumber?: string;
  model: string;
  category: string;
  note?: string;
  lines: SetDetailLine[];
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
  machineModel: "",
  notes: "",
};

const HISTORY_STORAGE_KEY = "efix-wholesale-order-history-v1";
const SET_COMPONENT_PARENT_IDS: Record<string, string[]> = {
  "part-013-102101272": ["part-008-4103020200"],
  "part-065-4109020156": [
    "part-054-4090040071",
    "part-055-4090040069",
  ],
  "part-123-4109020166": ["part-071-4103020384"],
  "part-127-kmp-021-1": ["part-126-kmp-024"],
  "part-129-kmp-022": ["part-128-kmp-021"],
  "part-131-kmp-010": ["part-130-kmp-025"],
  "part-134-kmp-020": ["part-133-kpm-002"],
  "part-136-kmp-021": ["part-135-kmp-004"],
  "part-139-kmp-003": ["part-138-kmp-002"],
  "part-142-kpm-010": ["part-141-kpm-009"],
};
const SET_COMPONENT_CHILD_IDS = new Set(Object.keys(SET_COMPONENT_PARENT_IDS));

const GENUINE_BRACKET_CATEGORIES = new Set(["外車ブラケット", "汎用ブラケット"]);

/** STEP3: E20載せ替えセット一式（親セット+構成部品の単品） */
function isTransferKitItem(
  item: Pick<WholesaleCatalogItem, "section">,
): boolean {
  return item.section === "載せ替えセット";
}

/** STEP3: スリーブ単品（DH1〜19・スペーサー等。載せ替えセット内のsleeve行は除く） */
function isSleeveItem(
  item: Pick<WholesaleCatalogItem, "section" | "category">,
): boolean {
  return !isTransferKitItem(item) && item.category === "スリーブ";
}

/** STEP5: CHC純正ブラケット（外車/汎用）+ 国産ブラケット機種別キット */
function isGenuineBracketItem(
  item: Pick<WholesaleCatalogItem, "section" | "category">,
): boolean {
  return (
    item.section === "国産ブラケット" ||
    GENUINE_BRACKET_CATEGORIES.has(item.category)
  );
}

const E20_STANDARD_SHARED_LINES: SetDetailLine[] = [
  {
    partNumber: "J1P502080902010005",
    name: "ESR-2 Receiver",
    quantity: "1",
  },
  {
    partNumber: "4006020058",
    name: "ESW-2 Electric Steering Wheel(36cm with horn)",
    quantity: "1",
  },
  { partNumber: "101990284", name: "Rear View Camera", quantity: "1" },
  {
    partNumber: "4103020345",
    name: "Integrated Main Cable(with horn connector)",
    quantity: "1",
  },
  {
    partNumber: "203000513",
    name: "Steering wheel power ball(1units)",
    quantity: "1",
    note: "カタログ未掲載",
  },
  {
    partNumber: "8006020027",
    name: "Steering wheel power ball(10units)",
    quantity: "1",
    note: "カタログ未掲載",
  },
  { partNumber: "4102030090", name: "ESR-1 Receiver Bracket", quantity: "2" },
  { partNumber: "103013031", name: "Plate with Ball", quantity: "2" },
  { partNumber: "103013032", name: "Double Socket Arm", quantity: "1" },
  {
    partNumber: "103011119",
    name: "Steering Wheel Mount (Standard)",
    quantity: "1",
  },
  { partNumber: "4102030042", name: "T Mount Kit (T)", quantity: "1" },
  { partNumber: "201170097", name: "T Mount Kit (B)", quantity: "1" },
  { partNumber: "4102030085", name: "T Mount Kit (A)", quantity: "1" },
  {
    partNumber: "101020493",
    name: "Radio Antenna(include magnetic mount)",
    quantity: "1",
  },
  { partNumber: "101020495", name: "radio magnetic mount", quantity: "1" },
  {
    partNumber: "4102180033",
    name: "Motor fixing bolt and nut set",
    quantity: "1",
  },
  { partNumber: "104990023", name: "Extended threaded screw", quantity: "1" },
  { partNumber: "104080012", name: "U-bolt M5*35*50 (304)", quantity: "1" },
];

const E20_PACKAGE_20_DETAIL: SetDetailGroup = {
  id: "e20-package-20",
  title: "eSteer 20 標準パッケージ",
  partNumber: "8006010189",
  model: "eSteer20/20MAX",
  category: "本体パッケージ",
  lines: [
    {
      partNumber: "4090040071",
      name: "ESD-2 Display(10 inch)",
      quantity: "1",
    },
    { partNumber: "4109020156", name: "ESNav (Android)", quantity: "1" },
    ...E20_STANDARD_SHARED_LINES,
  ],
};

const E20_PACKAGE_20MAX_DETAIL: SetDetailGroup = {
  id: "e20-package-20max",
  title: "eSteer 20MAX 標準パッケージ",
  partNumber: "8006010190",
  model: "eSteer20/20MAX",
  category: "本体パッケージ",
  lines: [
    {
      partNumber: "4090040069",
      name: "ESD-2 Display(12 inch)",
      quantity: "1",
    },
    { partNumber: "4109020156", name: "ESNav (Android)", quantity: "1" },
    ...E20_STANDARD_SHARED_LINES,
  ],
};

const SET_DETAIL_GROUPS_BY_PARENT_ID: Record<string, SetDetailGroup[]> = {
  "set-20": [E20_PACKAGE_20_DETAIL],
  "part-114-8006010189": [E20_PACKAGE_20_DETAIL],
  "set-20max": [E20_PACKAGE_20MAX_DETAIL],
  "part-115-8006010190": [E20_PACKAGE_20MAX_DETAIL],
};

const DISPLAY_ORDER_BY_ID: Record<string, number> = {
  "part-115-8006010190": 1002,
  "set-20max": 1002,
  "part-114-8006010189": 1003,
  "set-20": 1003,
  "part-053-j1p502080902010005": 1005,
  "part-054-4090040071": 1006,
  "part-065-4109020156": 1007,
  "part-055-4090040069": 1008,
  "part-056-4006020058": 1010,
  "part-058-101990284": 1011,
  "part-061-4103020345": 1012,
  "part-063-4102030090": 1015,
  "part-064-103013031": 1016,
  "part-062-103013032": 1017,
  "part-057-103011119": 1018,
  "part-060-4102180033": 1024,
  "part-067-104080012": 1026,
  "part-069-8006020025": 1039,
  "part-068-103016626": 1040,
  "part-119-4103020102": 1044,
  "part-120-4103020233": 1045,
  "part-118-4103020103": 1046,
  "part-070-4103020381": 1047,
  "part-090-4103020379": 1049,
  "part-117-4190070032": 1050,
  "part-116-8006020031": 1051,
  "part-087-4102030210": 1056,
  "part-073-4102120014": 1059,
  "part-074-4102030138": 1060,
  "part-076-4102030113": 1061,
  "part-077-4102030114": 1062,
  "part-078-4102030115": 1063,
  "part-079-4102030140": 1064,
  "part-075-4102030112": 1065,
  "part-080-4102030141": 1066,
  "part-111-4102030173": 1067,
  "part-089-4102030136": 1068,
  "part-083-4102030137": 1069,
  "part-086-4102030196": 1070,
  "part-084-4102030197": 1071,
  "part-085-4102030198": 1072,
  "part-088-4102030200": 1073,
  "part-082-4102030201": 1074,
  "part-081-4102030202": 1075,
  "part-092-4102150045": 1077,
  "part-093-4102150046": 1078,
  "part-094-4102150047": 1079,
  "part-095-4102150048": 1080,
  "part-096-4102150049": 1081,
  "part-097-4102150074": 1082,
  "part-098-4102150075": 1083,
  "part-099-4102150076": 1084,
  "part-100-4102150077": 1085,
  "part-101-4102150081": 1086,
  "part-102-4102150082": 1087,
  "part-103-4102150083": 1088,
  "part-104-4102150029": 1089,
  "part-105-4102150084": 1090,
  "part-106-4102150085": 1091,
  "part-107-4102150087": 1092,
  "part-108-4102150088": 1093,
  "part-109-4102150089": 1094,
  "part-110-4102150055": 1095,
  "part-113-4105170052": 1096,
  "part-112-4105170055": 1098,
  "part-071-4103020384": 1099,
  "part-123-4109020166": 1100,
  "part-072-4103020400": 1101,
  "part-122-4109020281": 1102,
  "part-121-4109020392": 1103,
  "part-091-4109020284": 1105,
  "part-052-8006010100": 2002,
  "set-10": 2002,
  "part-001-j1ac01980900010002": 2004,
  "part-002-4090040041": 2005,
  "part-003-4006020041": 2006,
  "part-005-102030373": 2009,
  "part-014-4109020155": 2010,
  "part-008-4103020200": 2012,
  "part-013-102101272": 2013,
  "part-007-4103020115": 2014,
  "part-006-4102180017": 2020,
  "part-011-4102030090": 2022,
  "part-009-103013031": 2023,
  "part-012-104080012": 2024,
  "part-010-103013032": 2025,
  "part-017-103013042": 2028,
  "part-019-4103020151": 2034,
  "part-026-4103020351": 2035,
  "part-018-4103020170": 2037,
  "part-020-4102120014": 2041,
  "part-021-4102030138": 2042,
  "part-023-4102030113": 2043,
  "part-024-4102030114": 2044,
  "part-025-4102030115": 2045,
  "part-022-4102030112": 2046,
  "part-027-2804070029": 2047,
  "part-028-2804070033": 2048,
  "part-031-2804070038": 2049,
  "part-032-2804070025": 2050,
  "part-033-2804990032": 2051,
  "part-034-2804070044": 2052,
  "part-035-2804070045": 2053,
  "part-036-2804070046": 2054,
  "part-045-4102150012": 2055,
  "part-046-4102150012": 2055,
  "part-047-4102150013": 2056,
  "part-048-4102150014": 2057,
  "part-049-4102150014": 2057,
  "part-029-2804070036": 2058,
  "part-038-2804030116": 2059,
  "part-039-2804990068": 2060,
  "part-042-4102150008": 2061,
  "part-043-4102150011": 2062,
  "part-044-4102150011": 2062,
  "part-037-2804070047": 2063,
  "part-050-4102150016": 2064,
  "part-030-2804070037": 2065,
  "part-051-4102150018": 2066,
  "part-041-4102150007": 2067,
  "part-040-4102150003": 2070,
  "part-133-kpm-002": 3004,
  "part-134-kmp-020": 3005,
  "part-138-kmp-002": 3006,
  "part-139-kmp-003": 3007,
  "part-135-kmp-004": 3008,
  "part-136-kmp-021": 3009,
  "part-141-kpm-009": 3010,
  "part-142-kpm-010": 3011,
  "part-128-kmp-021": 3012,
  "part-129-kmp-022": 3013,
  "part-140-kmp-023": 3014,
  "part-137-kpm-008": 3015,
  "part-125-kpm-006-esteer20": 3016,
  "part-124-kmp-007-esteer10": 3017,
  "part-130-kmp-025": 3018,
  "part-131-kmp-010": 3019,
  "part-126-kmp-024": 3020,
  "part-127-kmp-021-1": 3021,
  "part-132-kmp-010": 3022,
};

const LEGACY_DISPLAY_ORDER_BY_ID: Record<string, number> = {
  "part-052-8006010100": 2002,
  "set-10": 2002,
  "part-001-j1ac01980900010002": 2004,
  "part-002-4090040041": 2005,
  "part-003-4006020041": 2006,
  "part-005-102030373": 2009,
  "part-014-4109020155": 2010,
  "part-008-4103020200": 2012,
  "part-013-102101272": 2013,
  "part-007-4103020115": 2014,
  "part-006-4102180017": 2020,
  "part-011-4102030090": 2022,
  "part-009-103013031": 2023,
  "part-012-104080012": 2024,
  "part-010-103013032": 2025,
  "part-017-103013042": 2028,
  "part-120-4103020233": 2032,
  "part-118-4103020103": 2033,
  "part-019-4103020151": 2034,
  "part-026-4103020351": 2035,
  "part-117-4190070032": 2036,
  "part-018-4103020170": 2037,
  "part-020-4102120014": 2041,
  "part-021-4102030138": 2042,
  "part-023-4102030113": 2043,
  "part-024-4102030114": 2044,
  "part-025-4102030115": 2045,
  "part-022-4102030112": 2046,
  "part-027-2804070029": 2047,
  "part-028-2804070033": 2048,
  "part-031-2804070038": 2049,
  "part-032-2804070025": 2050,
  "part-033-2804990032": 2051,
  "part-034-2804070044": 2052,
  "part-035-2804070045": 2053,
  "part-036-2804070046": 2054,
  "part-045-4102150012": 2055,
  "part-046-4102150012": 2055,
  "part-047-4102150013": 2056,
  "part-048-4102150014": 2057,
  "part-049-4102150014": 2057,
  "part-029-2804070036": 2058,
  "part-038-2804030116": 2059,
  "part-039-2804990068": 2060,
  "part-042-4102150008": 2061,
  "part-043-4102150011": 2062,
  "part-044-4102150011": 2062,
  "part-037-2804070047": 2063,
  "part-050-4102150016": 2064,
  "part-030-2804070037": 2065,
  "part-051-4102150018": 2066,
  "part-041-4102150007": 2067,
  "part-040-4102150003": 2070,
  "part-133-kpm-002": 3004,
  "part-134-kmp-020": 3005,
  "part-138-kmp-002": 3006,
  "part-139-kmp-003": 3007,
  "part-135-kmp-004": 3008,
  "part-136-kmp-021": 3009,
  "part-141-kpm-009": 3010,
  "part-142-kpm-010": 3011,
  "part-128-kmp-021": 3012,
  "part-129-kmp-022": 3013,
  "part-140-kmp-023": 3014,
  "part-137-kpm-008": 3015,
  "part-125-kpm-006-esteer20": 3016,
  "part-124-kmp-007-esteer10": 3017,
  "part-130-kmp-025": 3018,
  "part-131-kmp-010": 3019,
  "part-126-kmp-024": 3020,
  "part-127-kmp-021-1": 3021,
  "part-132-kmp-010": 3022,
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

function sortByDisplayOrder(
  items: WholesaleCatalogItem[],
  displayOrderById: Record<string, number>,
): WholesaleCatalogItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rankA = displayOrderById[a.item.id] ?? 100000 + a.index;
      const rankB = displayOrderById[b.item.id] ?? 100000 + b.index;
      return rankA - rankB || a.index - b.index;
    })
    .map(({ item }) => item);
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
    "取付機種",
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
    customer.machineModel,
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
  if (item.category.includes("ブラケット")) return null;
  const text = `${item.shortName} ${item.name} ${item.partNumber}`.toLowerCase();
  if (text.includes("isobus ut")) return "単体無料";
  if (text.includes("esnav")) return "ディスプレイ付属";
  return "付属品";
}

function isPendingWholesalePrice(item: WholesaleCatalogItem): boolean {
  return (
    item.wholesalePriceExTax === 0 &&
    !zeroPriceLabel(item) &&
    !isHottaBracketItem(item)
  );
}

function isLinkedAccessory(item: WholesaleCatalogItem): boolean {
  const label = zeroPriceLabel(item);
  return Boolean(
    label &&
      (label !== "単体無料" || SET_COMPONENT_PARENT_IDS[item.id]?.length),
  );
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

  const displayOrderById =
    pageConfig.pageKey === "legacy"
      ? LEGACY_DISPLAY_ORDER_BY_ID
      : DISPLAY_ORDER_BY_ID;
  const orderedMainItems = useMemo(
    () => sortByDisplayOrder(mainItems, displayOrderById),
    [displayOrderById, mainItems],
  );
  const hottaBracketItems = useMemo(
    () =>
      sortByDisplayOrder(
        optionItems.filter((item) => isHottaBracketItem(item)),
        displayOrderById,
      ),
    [displayOrderById, optionItems],
  );
  const transferKitItems = useMemo(
    () =>
      sortByDisplayOrder(
        optionItems.filter((item) => isTransferKitItem(item)),
        displayOrderById,
      ),
    [displayOrderById, optionItems],
  );
  const genuineBracketItems = useMemo(
    () =>
      sortByDisplayOrder(
        optionItems.filter(
          (item) => !isTransferKitItem(item) && isGenuineBracketItem(item),
        ),
        displayOrderById,
      ),
    [displayOrderById, optionItems],
  );
  const regularOptionItems = useMemo(
    () =>
      sortByDisplayOrder(
        optionItems.filter(
          (item) =>
            !isHottaBracketItem(item) &&
            !isTransferKitItem(item) &&
            !isGenuineBracketItem(item),
        ),
        displayOrderById,
      ),
    [displayOrderById, optionItems],
  );
  const transferKitParentItems = useMemo(
    () => transferKitItems.filter((item) => item.partNumber === "JPN001"),
    [transferKitItems],
  );
  const standaloneOptionItems = useMemo(() => {
    const items = regularOptionItems.filter(
      (item) =>
        !SET_COMPONENT_CHILD_IDS.has(item.id) && !isSleeveItem(item),
    );
    // 先頭=載せ替えキット親SKU、末尾=テスト注文セクション
    return [
      ...transferKitParentItems,
      ...items.filter((item) => item.section !== "注文テスト"),
      ...items.filter((item) => item.section === "注文テスト"),
    ];
  }, [regularOptionItems, transferKitParentItems]);
  const sleeveItems = useMemo(
    () =>
      regularOptionItems.filter(
        (item) => isSleeveItem(item) && !SET_COMPONENT_CHILD_IDS.has(item.id),
      ),
    [regularOptionItems],
  );
  const bundledChildrenByParentId = useMemo(() => {
    const itemById = new Map(regularOptionItems.map((item) => [item.id, item]));
    const grouped: Record<string, WholesaleCatalogItem[]> = {};

    for (const [childId, parentIds] of Object.entries(SET_COMPONENT_PARENT_IDS)) {
      const child = itemById.get(childId);
      if (!child) continue;

      for (const parentId of parentIds) {
        if (!itemById.has(parentId)) continue;
        grouped[parentId] = [...(grouped[parentId] ?? []), child];
      }
    }

    // 載せ替えキットは親SKU(JPN001)のみ注文可、構成部品は親カード内の参考リスト
    for (const parent of transferKitParentItems) {
      grouped[parent.id] = [
        ...(grouped[parent.id] ?? []),
        ...transferKitItems.filter((item) => item.id !== parent.id),
      ];
    }

    return Object.fromEntries(
      Object.entries(grouped).map(([parentId, children]) => [
        parentId,
        sortByDisplayOrder(children, displayOrderById),
      ]),
    );
  }, [
    displayOrderById,
    regularOptionItems,
    transferKitItems,
    transferKitParentItems,
  ]);
  const allItems = useMemo(
    () => [
      ...orderedMainItems,
      ...regularOptionItems,
      ...transferKitItems,
      ...genuineBracketItems,
      ...hottaBracketItems,
    ],
    [
      genuineBracketItems,
      hottaBracketItems,
      orderedMainItems,
      regularOptionItems,
      transferKitItems,
    ],
  );
  const models = useMemo(
    () => unique(standaloneOptionItems.map((item) => item.model)),
    [standaloneOptionItems],
  );
  const categories = useMemo(
    () =>
      unique(
        standaloneOptionItems
          .filter((item) => modelFilter === "all" || item.model === modelFilter)
          .map((item) => item.category),
      ),
    [modelFilter, standaloneOptionItems],
  );
  const sections = useMemo(
    () =>
      unique(
        standaloneOptionItems
          .filter((item) => modelFilter === "all" || item.model === modelFilter)
          .map((item) => item.section),
      ),
    [modelFilter, standaloneOptionItems],
  );

  const visibleOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return standaloneOptionItems.filter((item) => {
      if (modelFilter !== "all" && item.model !== modelFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (sectionFilter !== "all" && item.section !== sectionFilter) return false;
      if (q) {
        const bundledSearchText = (bundledChildrenByParentId[item.id] ?? [])
          .map(itemSearchText)
          .join(" ");
        if (!`${itemSearchText(item)} ${bundledSearchText}`.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [
    bundledChildrenByParentId,
    categoryFilter,
    modelFilter,
    search,
    sectionFilter,
    standaloneOptionItems,
  ]);

  // STEP番号: 1=本体 → 2=部品(先頭に載せ替えキット) → スリーブ → 純正 → 堀田（表示されるセクションだけ連番で振る）
  const stepNumbers = (() => {
    let next = 1;
    const parts = ++next;
    const sleeve = sleeveItems.length > 0 ? ++next : null;
    const genuine = genuineBracketItems.length > 0 ? ++next : null;
    const hotta = hottaBracketItems.length > 0 ? ++next : null;
    return { parts, sleeve, genuine, hotta };
  })();

  const parentUnitCountFor = useCallback(
    (item: WholesaleCatalogItem): number => {
      const explicitParents = SET_COMPONENT_PARENT_IDS[item.id];
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
      return orderedMainItems.reduce(
        (sum, parent) => sum + (quantities[parent.id] ?? 0),
        0,
      );
    },
    [orderedMainItems, quantities],
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
  const hottaLines = useMemo(
    () => lines.filter((line) => isHottaBracketItem(line.item)),
    [lines],
  );
  const hasHottaLines = hottaLines.length > 0;
  const pendingHottaLines = useMemo(
    () => hottaLines.filter((line) => isHottaPricePendingItem(line.item)),
    [hottaLines],
  );
  const hasPendingHottaLines = pendingHottaLines.length > 0;

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
      pricePending: isHottaPricePendingItem(item),
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
    if (hasHottaLines && !customer.machineModel.trim()) {
      setSubmitResult({
        error: "堀田機工ブラケットを注文する場合は、取付機種を入力してください。",
      });
      return;
    }

    const confirmLines = lines
      .slice(0, 12)
      .map(
        ({ item, quantity }) => {
          const amount = isHottaPricePendingItem(item)
            ? "価格未定"
            : `¥${formatYen(item.wholesalePriceExTax * quantity)}`;
          return `・${item.shortName} / ${item.model} / ${item.category} x ${quantity} = ${amount}`;
        },
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
        ...(hasHottaLines ? [`取付機種: ${customer.machineModel}`] : []),
        "",
        ...confirmLines,
        "",
        `小計(税抜): ¥${formatYen(subtotalExTax)}`,
        `消費税: ¥${formatYen(tax)}`,
        `合計(税込): ¥${formatYen(totalIncTax)}`,
        ...(hasPendingHottaLines
          ? ["※価格未定の堀田機工ブラケットは、金額に含めていません。"]
          : []),
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

  const lineAmountLabel = (item: WholesaleCatalogItem, quantity: number) =>
    isHottaPricePendingItem(item)
      ? "価格未定"
      : `¥${formatYen(item.wholesalePriceExTax * quantity)}`;

  const unitPriceLabel = (item: WholesaleCatalogItem) =>
    isHottaPricePendingItem(item)
      ? "価格未定"
      : `¥${formatYen(item.wholesalePriceExTax)}`;

  const renderSetDetailGroup = (group: SetDetailGroup) => (
    <details key={group.id} className="mt-3 border-l-2 border-cyan-200 pl-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-bold text-cyan-800 [&::-webkit-details-marker]:hidden">
        <span>
          セット内容
          {group.partNumber ? ` / ${group.partNumber}` : ""}
        </span>
        <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-800">
          {group.lines.length}件
        </span>
      </summary>
      <p className="mt-1 text-xs font-semibold text-stone-700">{group.title}</p>
      {group.note && <p className="mt-1 text-xs text-stone-500">{group.note}</p>}
      <ul className="mt-2 grid gap-1">
        {group.lines.map((line, index) => (
          <li
            key={`${group.id}-${line.partNumber}-${index}`}
            className="grid gap-1 text-xs text-stone-600 sm:grid-cols-[minmax(96px,auto)_1fr_42px]"
          >
            <span className="font-mono text-stone-500">{line.partNumber}</span>
            <span>
              <span className="font-semibold text-stone-700">{line.name}</span>
              {line.note && (
                <span className="ml-2 text-[11px] font-semibold text-amber-700">
                  {line.note}
                </span>
              )}
            </span>
            <span className="font-mono text-stone-500">x {line.quantity}</span>
          </li>
        ))}
      </ul>
    </details>
  );

  const renderMainItem = (item: WholesaleCatalogItem) => {
    const detailGroups = SET_DETAIL_GROUPS_BY_PARENT_ID[item.id] ?? [];
    return (
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
            priority={item.id === orderedMainItems[0]?.id}
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
            {detailGroups.map(renderSetDetailGroup)}
          </div>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-stone-500">
                {isPendingWholesalePrice(item) ? "卸価格確認中" : priceLabel}
              </p>
              <p
                className={`font-mono text-2xl font-bold ${
                  isPendingWholesalePrice(item)
                    ? "text-stone-700"
                    : "text-emerald-700"
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
  };

  const renderOptionItem = (item: WholesaleCatalogItem) => {
    const bundledChildren = bundledChildrenByParentId[item.id] ?? [];
    const detailGroups = SET_DETAIL_GROUPS_BY_PARENT_ID[item.id] ?? [];
    return (
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
              {bundledChildren.length > 0 && (
                <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-800">
                  セット販売
                </span>
              )}
              {detailGroups.length > 0 && (
                <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-800">
                  内容あり
                </span>
              )}
              {isHottaBracketItem(item) && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                  {isHottaPricePendingItem(item)
                    ? "堀田機工・価格未定"
                    : "堀田機工製作"}
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
            {bundledChildren.length > 0 && (
              <details className="mt-3 border-l-2 border-cyan-200 pl-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-bold text-cyan-800 [&::-webkit-details-marker]:hidden">
                  <span>セット構成</span>
                  <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-800">
                    {bundledChildren.length}件
                  </span>
                </summary>
                <ul className="mt-1 grid gap-1.5">
                  {bundledChildren.map((child, childIndex) => (
                    <li
                      key={child.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-stone-600"
                    >
                      <span className="w-5 shrink-0 text-right font-mono font-bold text-cyan-800">
                        {childIndex + 1}
                      </span>
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-50">
                        <Image
                          src={child.image}
                          alt={child.name}
                          fill
                          sizes="40px"
                          className="object-contain p-0.5"
                        />
                      </span>
                      <span className="font-mono text-stone-500 sm:min-w-[88px]">
                        {child.partNumber || "-"}
                      </span>
                      <span className="font-semibold text-stone-700">
                        {child.shortName}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {detailGroups.map(renderSetDetailGroup)}
          </div>
          <div className="font-mono">
            <p className="text-xs text-stone-500">
              {isPendingWholesalePrice(item)
                ? "卸価格確認中"
                : isHottaBracketItem(item)
                  ? "堀田機工へ注文書送付"
                  : (zeroPriceLabel(item) ?? priceLabel)}
            </p>
            <p
              className={`text-lg font-bold ${
                isPendingWholesalePrice(item)
                  ? "text-stone-700"
                  : isHottaBracketItem(item)
                    ? "text-amber-700"
                    : "text-emerald-700"
              }`}
            >
              {isPendingWholesalePrice(item) ? "要確認" : unitPriceLabel(item)}
            </p>
            {isHottaBracketItem(item) && (
              <p className="text-xs font-semibold text-amber-700">
                機種入力後、注文書を堀田機工へ送付
              </p>
            )}
            {zeroPriceNote(item) && (
              <p className="text-xs font-semibold text-emerald-700">
                {zeroPriceNote(item)}
              </p>
            )}
            {bundledChildren.length > 0 && (
              <p className="text-xs font-semibold text-cyan-700">
                構成品を含むセット
              </p>
            )}
            <p className="text-xs text-stone-500">必要数 {item.requiredQty}</p>
          </div>
          {renderQuantity(item)}
        </div>
      </article>
    );
  };

  const renderHottaBracketItem = (item: WholesaleCatalogItem) => (
    <article
      key={item.id}
      className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_116px] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-stone-950">{item.shortName}</h3>
          {isHottaPricePendingItem(item) ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              価格未定
            </span>
          ) : (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              ¥{formatYen(item.wholesalePriceExTax)} 税抜
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-stone-500">
          取付機種を添えて堀田機工へ注文書を送付
        </p>
      </div>
      {renderQuantity(item)}
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
            <div className="grid gap-4">{orderedMainItems.map(renderMainItem)}</div>
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
              <p className="text-sm font-bold text-emerald-700">
                STEP {stepNumbers.parts}
              </p>
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

          {sleeveItems.length > 0 && (
            <details className="group">
              <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 [&::-webkit-details-marker]:hidden">
                <p className="text-sm font-bold text-emerald-700">
                  STEP {stepNumbers.sleeve}
                </p>
                <h2 className="text-2xl font-black">スリーブを選択</h2>
                <span className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white group-open:hidden">
                  スリーブを表示
                </span>
                <span className="hidden rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 group-open:inline-flex">
                  閉じる
                </span>
              </summary>

              <div className="hidden space-y-4 group-open:block">
                <div className="grid gap-3">{sleeveItems.map(renderOptionItem)}</div>
              </div>
            </details>
          )}

          {genuineBracketItems.length > 0 && (
            <details className="group">
              <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 [&::-webkit-details-marker]:hidden">
                <p className="text-sm font-bold text-emerald-700">
                  STEP {stepNumbers.genuine}
                </p>
                <h2 className="text-2xl font-black">純正ブラケットを選択</h2>
                <span className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white group-open:hidden">
                  ブラケットを表示
                </span>
                <span className="hidden rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 group-open:inline-flex">
                  閉じる
                </span>
              </summary>

              <div className="hidden space-y-4 group-open:block">
                <div className="grid gap-3">
                  {genuineBracketItems.map(renderOptionItem)}
                </div>
              </div>
            </details>
          )}

          {hottaBracketItems.length > 0 && (
            <details className="group">
              <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 [&::-webkit-details-marker]:hidden">
                <p className="text-sm font-bold text-emerald-700">
                  STEP {stepNumbers.hotta}
                </p>
                <h2 className="text-2xl font-black">堀田機工ブラケットを選択</h2>
                <span className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white group-open:hidden">
                  ブラケットを表示
                </span>
                <span className="hidden rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 group-open:inline-flex">
                  閉じる
                </span>
              </summary>

              <div className="hidden space-y-4 group-open:block">
                <div className="grid gap-3">
                  {hottaBracketItems.map(renderHottaBracketItem)}
                </div>

                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-amber-800">取付機種</span>
                    <input
                      value={customer.machineModel}
                      onChange={(event) =>
                        changeCustomer("machineModel", event.target.value)
                      }
                      aria-required={hasHottaLines}
                      placeholder="例: クボタ MR1000 / 三菱 GV651"
                      className={`h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-emerald-500 ${
                        hasHottaLines && !customer.machineModel.trim()
                          ? "border-amber-400"
                          : "border-stone-300"
                      }`}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-amber-800">備考</span>
                    <textarea
                      value={customer.notes}
                      onChange={(event) => changeCustomer("notes", event.target.value)}
                      placeholder="堀田機工注文書に入れる補足"
                      rows={3}
                      className="w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                  </label>
                </div>
              </div>
            </details>
          )}
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
                        {lineAmountLabel(item, quantity)}
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
              {hasPendingHottaLines && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                  価格未定の堀田機工ブラケット {pendingHottaLines.length}
                  件は、上記金額には含めていません。
                </p>
              )}
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
