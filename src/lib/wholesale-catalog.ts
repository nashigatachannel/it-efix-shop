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

export const WHOLESALE_TAX_RATE = catalog.taxRate;
export const WHOLESALE_HERO_IMAGE = catalog.heroImage;
export const WHOLESALE_MAIN_ITEMS =
  catalog.mainItems as WholesaleCatalogItem[];
export const WHOLESALE_OPTION_ITEMS =
  catalog.optionItems as WholesaleCatalogItem[];
export const WHOLESALE_IMAGE_ASSETS =
  catalog.imageAssets as WholesaleImageAsset[];
export const WHOLESALE_ALL_ITEMS: WholesaleCatalogItem[] = [
  ...WHOLESALE_MAIN_ITEMS,
  ...WHOLESALE_OPTION_ITEMS,
];

export const SPECIAL_WHOLESALE_MAIN_ITEMS =
  specialCatalog.mainItems as WholesaleCatalogItem[];
export const SPECIAL_WHOLESALE_OPTION_ITEMS =
  specialCatalog.optionItems as WholesaleCatalogItem[];
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

export function wholesaleItemsForTier(
  tier: PartnerTier | null | undefined,
): WholesaleCatalogItem[] {
  return tier === "distributor"
    ? SPECIAL_WHOLESALE_ALL_ITEMS
    : WHOLESALE_ALL_ITEMS;
}
