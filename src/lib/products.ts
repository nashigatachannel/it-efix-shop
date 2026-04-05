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
  description: string;
  features: string[];
  isOption?: boolean;
  image?: string;
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
    priceExTax: 909_091,
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
    priceExTax: 1_045_455,
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
    priceExTax: 1_181_819,
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
    id: "option-large-wheel",
    name: "大型ハンドル（400mm）",
    priceExTax: 12_000,
    description: "標準360mmより大きい400mmステアリングホイール。操作しやすさが向上。",
    features: ["400mm大径", "交換用ステアリングホイール"],
    isOption: true,
    image: "https://efix-agriculture.oss-eu-central-1.aliyuncs.com/uploads/images/202506/b1d0f7ffffc7c825dffe43b6de3e73f1.jpg",
  },
  {
    id: "option-physical-button",
    name: "物理ボタン（Engage/Disengage）",
    priceExTax: 14_600,
    description: "自動操舵のON/OFFを手元で切り替えられる物理ボタン。",
    features: ["ワンタッチ操作", "eSteer 20 MAX対応"],
    isOption: true,
  },
  {
    id: "option-multi-function",
    name: "マルチファンクションボタン",
    priceExTax: 37_500,
    description: "複数機能を割り当てられる多機能ボタンユニット。",
    features: ["多機能操作", "カスタマイズ可能"],
    isOption: true,
  },
  {
    id: "option-wireless-remote",
    name: "無線リモコン",
    priceExTax: 25_000,
    description: "無線で自動操舵を制御できるリモートボタン。",
    features: ["ワイヤレス操作", "離れた場所から制御可能"],
    isOption: true,
  },
];

export const ALL_PRODUCTS: Product[] = [...MAIN_PRODUCTS, ...OPTION_PRODUCTS, ...DONATION_PRODUCTS];

export function getProductById(id: ProductId): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.id === id);
}
