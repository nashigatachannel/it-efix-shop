export type ProductId =
  | "e-steer-10"
  | "e-steer-20"
  | "e-steer-20-max"
  | "option-install"
  | "option-bracket"
  | "option-sleeve"
  | "donation-miso";

export interface Product {
  id: ProductId;
  name: string;
  priceExTax: number;
  description: string;
  features: string[];
  isOption?: boolean;
}

export const TAX_RATE = 0.1;

export function calcTaxIncluded(priceExTax: number): number {
  return Math.floor(priceExTax * (1 + TAX_RATE));
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

export const MAIN_PRODUCTS: Product[] = [
  {
    id: "e-steer-10",
    name: "e-steer 10",
    priceExTax: 820_000,
    description: "スタンダードモデル。小〜中型農機に対応する入門機。",
    features: [
      "小〜中型農機対応",
      "シンプルな操作パネル",
      "標準精度GPS連携",
      "コンパクト設計",
    ],
  },
  {
    id: "e-steer-20",
    name: "e-steer 20",
    priceExTax: 900_000,
    description: "高精度モデル。RTK-GPS対応で直進精度を大幅向上。",
    features: [
      "RTK-GPS対応",
      "高精度直進アシスト ±2cm",
      "大型農機対応",
      "拡張オプション対応",
    ],
  },
  {
    id: "e-steer-20-max",
    name: "e-steer 20 MAX",
    priceExTax: 1_000_000,
    description: "フラッグシップモデル。最高精度と最大トルクを両立。",
    features: [
      "最高精度 ±1cm",
      "最大トルク出力",
      "全農機種対応",
      "クラウド管理・データ連携",
    ],
  },
];

export const OPTION_PRODUCTS: Product[] = [
  {
    id: "option-install",
    name: "取付料",
    priceExTax: 100_000,
    description: "専任スタッフによる現地取付作業一式。",
    features: ["現地出張取付", "動作確認・調整込み"],
    isOption: true,
  },
  {
    id: "option-bracket",
    name: "取付ブラケット",
    priceExTax: 100_000,
    description: "各農機メーカー対応の専用取付ブラケット。",
    features: ["農機メーカー別適合品", "高剛性アルミ製"],
    isOption: true,
  },
  {
    id: "option-sleeve",
    name: "スリーブ",
    priceExTax: 8_000,
    description: "ステアリングシャフト接続用スリーブ。",
    features: ["各種シャフト径対応", "精密加工品"],
    isOption: true,
  },
];

export const ALL_PRODUCTS: Product[] = [...MAIN_PRODUCTS, ...OPTION_PRODUCTS, ...DONATION_PRODUCTS];

export function getProductById(id: ProductId): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.id === id);
}
