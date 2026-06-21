import catalog from "./wholesale-catalog.generated.json";
import specialCatalog from "./wholesale-catalog.special.generated.json";
import type { PartnerTier } from "@/lib/partner-auth";

export type WholesaleItemKind = "set" | "part";

export interface WholesaleCatalogItem {
  id: string;
  kind: WholesaleItemKind;
  shortName: string;
  model: string;
  section: string;
  category: string;
  partNumber: string;
  name: string;
  requiredQty: number;
  wholesalePriceExTax: number;
  retailPriceExTax: number | null;
  wholesalePriceIncTax: number;
  retailPriceIncTax: number | null;
  image: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface WholesaleImageAsset {
  sourceName: string;
  path: string;
  width: number;
  height: number;
  rowHint: number | null;
  modelHint: string;
  categoryHint: string;
}

const HOTTA_BRACKET_ORDER_ITEMS: WholesaleCatalogItem[] = [
  {
    id: "hotta-motor-mount",
    kind: "part",
    shortName: "モーター固定金具",
    model: "共用",
    section: "堀田機工",
    category: "ブラケット",
    partNumber: "",
    name: "モーター固定金具",
    requiredQty: 1,
    wholesalePriceExTax: 0,
    retailPriceExTax: null,
    wholesalePriceIncTax: 0,
    retailPriceIncTax: null,
    image: "/wholesale-assets/image-pending.png",
    sourceSheet: "堀田機工注文",
    sourceRow: 1,
  },
  {
    id: "hotta-antenna-plate",
    kind: "part",
    shortName: "アンテナプレート",
    model: "共用",
    section: "堀田機工",
    category: "ブラケット",
    partNumber: "",
    name: "アンテナプレート",
    requiredQty: 1,
    wholesalePriceExTax: 0,
    retailPriceExTax: null,
    wholesalePriceIncTax: 0,
    retailPriceIncTax: null,
    image: "/wholesale-assets/image-pending.png",
    sourceSheet: "堀田機工注文",
    sourceRow: 2,
  },
  {
    id: "hotta-antenna-bracket",
    kind: "part",
    shortName: "アンテナブラケット",
    model: "共用",
    section: "堀田機工",
    category: "ブラケット",
    partNumber: "",
    name: "アンテナブラケット",
    requiredQty: 1,
    wholesalePriceExTax: 0,
    retailPriceExTax: null,
    wholesalePriceIncTax: 0,
    retailPriceIncTax: null,
    image: "/wholesale-assets/image-pending.png",
    sourceSheet: "堀田機工注文",
    sourceRow: 3,
  },
  {
    id: "hotta-monitor-bracket",
    kind: "part",
    shortName: "モニターブラケット",
    model: "共用",
    section: "堀田機工",
    category: "ブラケット",
    partNumber: "",
    name: "モニターブラケット",
    requiredQty: 1,
    wholesalePriceExTax: 0,
    retailPriceExTax: null,
    wholesalePriceIncTax: 0,
    retailPriceIncTax: null,
    image: "/wholesale-assets/image-pending.png",
    sourceSheet: "堀田機工注文",
    sourceRow: 4,
  },
];

const HOTTA_BRACKET_ORDER_ITEM_IDS = new Set(
  HOTTA_BRACKET_ORDER_ITEMS.map((item) => item.id),
);

export const WHOLESALE_TAX_RATE = catalog.taxRate;
export const WHOLESALE_HERO_IMAGE = catalog.heroImage;
export const WHOLESALE_MAIN_ITEMS =
  catalog.mainItems as WholesaleCatalogItem[];
export const WHOLESALE_OPTION_ITEMS: WholesaleCatalogItem[] = [
  ...(catalog.optionItems as WholesaleCatalogItem[]),
  ...HOTTA_BRACKET_ORDER_ITEMS,
];
export const WHOLESALE_IMAGE_ASSETS =
  catalog.imageAssets as WholesaleImageAsset[];
export const WHOLESALE_ALL_ITEMS: WholesaleCatalogItem[] = [
  ...WHOLESALE_MAIN_ITEMS,
  ...WHOLESALE_OPTION_ITEMS,
];

export const SPECIAL_WHOLESALE_MAIN_ITEMS =
  specialCatalog.mainItems as WholesaleCatalogItem[];
export const SPECIAL_WHOLESALE_OPTION_ITEMS: WholesaleCatalogItem[] = [
  ...(specialCatalog.optionItems as WholesaleCatalogItem[]),
  ...HOTTA_BRACKET_ORDER_ITEMS,
];
export const SPECIAL_WHOLESALE_ALL_ITEMS: WholesaleCatalogItem[] = [
  ...SPECIAL_WHOLESALE_MAIN_ITEMS,
  ...SPECIAL_WHOLESALE_OPTION_ITEMS,
];

export function formatYen(value: number): string {
  return value.toLocaleString("ja-JP");
}

export function findWholesaleItem(id: string): WholesaleCatalogItem | undefined {
  return WHOLESALE_ALL_ITEMS.find((item) => item.id === id);
}

export function isHottaBracketItem(
  item: Pick<WholesaleCatalogItem, "id">,
): boolean {
  return HOTTA_BRACKET_ORDER_ITEM_IDS.has(item.id);
}

export function isGeneratedHottaBracketItem(
  item: Pick<WholesaleCatalogItem, "id" | "category" | "wholesalePriceExTax">,
): boolean {
  return (
    item.category === "ブラケット" &&
    item.wholesalePriceExTax === 0 &&
    !isHottaBracketItem(item)
  );
}

export function wholesaleItemsForTier(
  tier: PartnerTier | null | undefined,
): WholesaleCatalogItem[] {
  return tier === "distributor"
    ? SPECIAL_WHOLESALE_ALL_ITEMS
    : WHOLESALE_ALL_ITEMS;
}
