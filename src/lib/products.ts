export type ProductId =
  | "e-steer-10"
  | "e-steer-20"
  | "e-steer-20-max"
  | "option-large-wheel"
  | "option-physical-button"
  | "option-multi-function"
  | "option-wireless-remote"
  | "donation-miso";

export interface Product {
  id: ProductId;
  name: string;
  priceExTax: number;
  /** 通常卸価格(税抜)。未設定なら卸ページで非販売 */
  wholesalePriceExTax?: number;
  /** 特価卸価格(税抜)。未設定なら特価卸ページで非販売 */
  distributorPriceExTax?: number;
  description: string;
  features: string[];
  isOption?: boolean;
  image?: string;
  /** 販売停止フラグ。trueの場合、新規販売ページから除外（履歴表示用に定義は残す） */
  isDiscontinued?: boolean;
}

export type PriceTier = "retail" | "wholesale" | "distributor";

export const TAX_RATE = 0.1;

export function calcTaxIncluded(priceExTax: number): number {
  return Math.floor(priceExTax * (1 + TAX_RATE));
}

export function getPriceForTier(p: Product, tier: PriceTier): number | null {
  if (tier === "retail") return p.priceExTax;
  if (tier === "wholesale")
    return p.wholesalePriceExTax ?? p.priceExTax;
  if (tier === "distributor")
    return p.distributorPriceExTax ?? p.wholesalePriceExTax ?? p.priceExTax;
  return p.priceExTax;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ja-JP");
}

export const DONATION_PRODUCTS: Product[] = [
  {
    id: "donation-miso",
    name: "支援・寄付（お味噌汁代）",
    priceExTax: 100,
    description: "E-FIXへの応援・支援です。ありがとうございます！",
    features: ["お気持ち支援", "税込110円"],
    isOption: true,
  },
];

/** 履歴互換性のために残す販売停止製品 (新規販売ページからは isDiscontinued で除外) */
const DISCONTINUED_PRODUCTS: Product[] = [
  {
    id: "e-steer-10",
    name: "e-steer 10",
    priceExTax: 909_091,
    wholesalePriceExTax: 650_000,
    distributorPriceExTax: 610_000,
    description: "スタンダードモデル（販売終了）",
    features: ["小〜中型農機対応"],
    isDiscontinued: true,
  },
];

export const MAIN_PRODUCTS: Product[] = [
  {
    id: "e-steer-20",
    name: "e-steer 20",
    priceExTax: 1_045_455,
    wholesalePriceExTax: 720_000,
    distributorPriceExTax: 650_000,
    description:
      "10.1インチディスプレイ搭載モデル。国産トラクター・コンバインのキャビン内に収まりやすく、最も人気のサイズ。",
    features: [
      "10.1インチディスプレイ",
      "国産農機キャビンに最適",
      "高精度自動操舵 ±2.5cm",
      "ISOBUS対応 / 載せ替え可能",
    ],
  },
  {
    id: "e-steer-20-max",
    name: "e-steer 20 MAX",
    priceExTax: 1_181_819,
    wholesalePriceExTax: 800_000,
    distributorPriceExTax: 700_000,
    description:
      "12.1インチ大型ディスプレイ搭載モデル。外車トラクター（CASE / John Deere / Fendt 等）の広いキャビン、または視認性を重視する方におすすめ。性能スペックは20と完全に同等。",
    features: [
      "12.1インチ大型ディスプレイ",
      "外車トラクター向け / 老眼対策",
      "高精度自動操舵 ±2.5cm",
      "ISOBUS対応 / 載せ替え可能",
    ],
  },
];

export const OPTION_PRODUCTS: Product[] = [
  {
    id: "option-large-wheel",
    name: "大型ハンドル（400mm）",
    priceExTax: 12_000,
    wholesalePriceExTax: 8_400,
    distributorPriceExTax: 7_200,
    description: "標準360mmより大きい400mmステアリングホイール。操作しやすさが向上。",
    features: ["400mm大径", "交換用ステアリングホイール"],
    isOption: true,
    image: "https://efix-agriculture.oss-eu-central-1.aliyuncs.com/uploads/images/202506/b1d0f7ffffc7c825dffe43b6de3e73f1.jpg",
  },
  {
    id: "option-physical-button",
    name: "物理ボタン（Engage/Disengage）",
    priceExTax: 14_600,
    wholesalePriceExTax: 10_220,
    distributorPriceExTax: 8_760,
    description: "自動操舵のON/OFFを手元で切り替えられる物理ボタン。",
    features: ["ワンタッチ操作", "eSteer 20 MAX対応"],
    isOption: true,
  },
  {
    id: "option-multi-function",
    name: "マルチファンクションボタン",
    priceExTax: 37_500,
    wholesalePriceExTax: 26_250,
    distributorPriceExTax: 22_500,
    description: "複数機能を割り当てられる多機能ボタンユニット。",
    features: ["多機能操作", "カスタマイズ可能"],
    isOption: true,
  },
  {
    id: "option-wireless-remote",
    name: "無線リモコン",
    priceExTax: 25_000,
    wholesalePriceExTax: 17_500,
    distributorPriceExTax: 15_000,
    description: "無線で自動操舵を制御できるリモートボタン。",
    features: ["ワイヤレス操作", "離れた場所から制御可能"],
    isOption: true,
  },
];

export const ALL_PRODUCTS: Product[] = [
  ...MAIN_PRODUCTS,
  ...DISCONTINUED_PRODUCTS,
  ...OPTION_PRODUCTS,
  ...DONATION_PRODUCTS,
];

export function getProductById(id: ProductId): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.id === id);
}
