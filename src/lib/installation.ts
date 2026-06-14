import type { ProductId } from "./products";

// 取付サービス料金（税込）。本体製品の販売価格に含まれる「取付サービス分」を表す。
// 「取付サービス不要（自分で取付する）」オプトアウト時に、商品単価からこの金額を減算する。
//
// 価格設計の詳細は docs/efix-requirements-v3.md §23.2 を参照。
// 内訳（本体・取付工賃・ブラケット・延長ケーブル等）は経営判断で非公開。
const INSTALLATION_FEE_INC_TAX: Partial<Record<ProductId, number>> = {
  "e-steer-20": 160_000,
  "e-steer-20-max": 200_000,
};

export function getInstallationFeeIncTax(productId: ProductId): number {
  return INSTALLATION_FEE_INC_TAX[productId] ?? 0;
}

export function hasInstallationService(productId: ProductId): boolean {
  return getInstallationFeeIncTax(productId) > 0;
}

export interface InstallationDiscountLine {
  productId: ProductId;
  quantity: number;
  unitDiscount: number;
  lineDiscount: number;
}

export function calcInstallationDiscount(
  lines: { productId: ProductId; quantity: number }[],
  selfInstall: boolean,
): {
  totalDiscount: number;
  lineBreakdown: InstallationDiscountLine[];
} {
  if (!selfInstall) {
    return { totalDiscount: 0, lineBreakdown: [] };
  }
  const lineBreakdown: InstallationDiscountLine[] = [];
  let totalDiscount = 0;
  for (const { productId, quantity } of lines) {
    const unitDiscount = getInstallationFeeIncTax(productId);
    if (unitDiscount > 0 && quantity > 0) {
      const lineDiscount = unitDiscount * quantity;
      lineBreakdown.push({ productId, quantity, unitDiscount, lineDiscount });
      totalDiscount += lineDiscount;
    }
  }
  return { totalDiscount, lineBreakdown };
}
