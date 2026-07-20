import { findProductByLooseId } from "@/lib/products";

/**
 * Web注文の「モデル」列（G列）の1行分。
 * 保存形式は `productId×数量`（数量1のときはサフィックスなし）をカンマ区切り、
 * または（V3以降のnewフロー）人間が読める商品名がそのまま入る場合もある。
 * どちらの形式でも defensively に扱えるようパースする。
 */
export interface ParsedOrderLine {
  /** 元のトークン文字列（未知IDのフォールバック表示用） */
  raw: string;
  /** 表示用の商品名。IDが商品マスタで解決できればその名前、できなければ raw をそのまま使う */
  displayName: string;
  /** ×N サフィックスから読み取った数量。サフィックスがなければ null（=1点扱い） */
  quantity: number | null;
  /** 商品マスタで解決できたかどうか */
  resolved: boolean;
}

const QUANTITY_SUFFIX_PATTERN = /^(.+)×(\d+)$/u;

export function parseOrderModelString(model: string): ParsedOrderLine[] {
  if (!model || !model.trim()) return [];

  return model
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const match = token.match(QUANTITY_SUFFIX_PATTERN);
      const idPart = match ? match[1] : token;
      const quantity = match ? Number(match[2]) : null;
      const product = findProductByLooseId(idPart);

      return {
        raw: token,
        displayName: product ? product.name : idPart,
        quantity,
        resolved: Boolean(product),
      };
    });
}

/** 一覧のモデル列などに出す、カンマ区切りの短い表示文字列を組み立てる。 */
export function formatOrderModelSummary(model: string): string {
  const lines = parseOrderModelString(model);
  if (lines.length === 0) return "";

  return lines
    .map((line) =>
      line.quantity && line.quantity > 1
        ? `${line.displayName}×${line.quantity}`
        : line.displayName,
    )
    .join(", ");
}
