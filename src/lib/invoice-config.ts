/**
 * 適格請求書（インボイス制度）発行設定
 *
 * 日本の消費税法57条の4が定める「適格請求書」の6要件を
 * Stripe Invoicing で満たすための設定値。
 */

/**
 * 適格請求書発行事業者 登録番号
 * 令和8年1月1日付で札幌南税務署より発行
 */
export const INVOICE_REGISTRATION_NUMBER = "T2810703528253";

/**
 * 発行事業者情報
 */
export const INVOICE_ISSUER = {
  name: "IT",
  representativeName: "石川卓磨",
  postalCode: "062-0041",
  address: "北海道札幌市豊平区福住一条７丁目4-13",
  phone: "080-6282-4834",
  email: "takuma.ishikawa.line@gmail.com",
} as const;

/**
 * Stripe Tax Rate ID（日本の消費税 10% 内税）
 * 事前に `stripe.taxRates.create` で作成済み
 */
export const JP_TAX_RATE_ID = "txr_1TKBjgH2z67GEPwFudwPQGZW";

/**
 * 適格請求書フッター（法定記載事項）
 * Stripe Invoice の footer に設定する。
 */
export const INVOICE_FOOTER = [
  "【適格請求書発行事業者】",
  `登録番号: ${INVOICE_REGISTRATION_NUMBER}`,
  `事業者名: ${INVOICE_ISSUER.name}（${INVOICE_ISSUER.representativeName}）`,
  `所在地: 〒${INVOICE_ISSUER.postalCode} ${INVOICE_ISSUER.address}`,
  `TEL: ${INVOICE_ISSUER.phone}`,
  `Email: ${INVOICE_ISSUER.email}`,
  "",
  "本書類は消費税法第57条の4に基づく適格請求書です。",
  "表示価格は消費税（10%）を含む税込金額です。",
].join("\n");

/**
 * Stripe Invoice の custom_fields（最大4件）
 * 請求書PDFのヘッダー付近に表示される。
 */
export const INVOICE_CUSTOM_FIELDS: Array<{ name: string; value: string }> = [
  { name: "登録番号", value: INVOICE_REGISTRATION_NUMBER },
  { name: "適用税率", value: "消費税 10%（内税）" },
];
