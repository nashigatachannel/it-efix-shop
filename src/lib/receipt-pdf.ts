import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import subsetFont from "subset-font";
import {
  INVOICE_ISSUER,
  INVOICE_REGISTRATION_NUMBER,
} from "@/lib/invoice-config";

/** 適格請求書の明細1行分。金額は税込の行合計。 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number | null;
  amountTotal: number;
}

export interface InvoiceData {
  /** 請求書番号（Web注文の通し番号ベース） */
  documentNumber: string;
  /** 宛名（「様」は付けずに渡す） */
  addressee: string;
  /** 明細行 */
  lineItems: InvoiceLineItem[];
  /** 税込合計金額（円） */
  amountTotal: number;
  /** 取引年月日（注文日時の表示文字列） */
  transactionDate: string;
  /** 支払方法の表示名 */
  paymentMethodLabel: string;
  /** 発行日（表示文字列） */
  issuedDate: string;
}

const FONT_DIR = path.join(process.cwd(), "src", "lib", "assets", "fonts");

const PAGE_WIDTH = 595.28; // A4縦 (pt)
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;

const INK = rgb(0.15, 0.15, 0.15);
const ACCENT = rgb(0.043, 0.502, 0.42); // #0b806b（サイトのブランド緑）
const RULE = rgb(0.75, 0.75, 0.75);
const RULE_LIGHT = rgb(0.88, 0.88, 0.88);

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/**
 * 税込金額から税抜金額・消費税額(10%)を逆算する。端数は税抜側を切り上げ
 * （＝税額切り捨て）とする。
 */
export function splitTax(amountTotal: number): {
  taxExcluded: number;
  tax: number;
} {
  const taxExcluded = Math.ceil(amountTotal / 1.1);
  return { taxExcluded, tax: amountTotal - taxExcluded };
}

function drawTextRight(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  rightX: number,
  y: number,
  color = INK,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color });
}

function drawTextCenter(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  color = INK,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
}

/** 指定幅に収まるよう末尾を「…」で切り詰める。 */
function truncateToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (
    result.length > 1 &&
    font.widthOfTextAtSize(`${result}…`, size) > maxWidth
  ) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/**
 * 適格請求書（消費税法57条の4の記載要件を満たす、支払済み取引の書類）を生成する。
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONT_DIR, "ZenKakuGothicNew-Regular.ttf")),
    fs.readFile(path.join(FONT_DIR, "ZenKakuGothicNew-Bold.ttf")),
  ]);

  // 本文に登場しうる全文字をかき集めてフォントをサブセット化する。
  // fontkit(pdf-lib) の CJK サブセットはグリフ欠落バグがあるため、
  // harfbuzz ベースの subset-font で先に絞り込み、pdf-lib へはフル埋め込み扱いで渡す。
  const usedChars =
    [
      "適格請求書発行日番号登録様下記の通りご請求申し上げます。",
      "本に係る代金はお支払い済みです品名数量単価金額小計税抜対象消費合計込方法取引年月日",
      "本書類は消費税法第57条の4に基づく適格請求書です。",
      "電子的に発行された書類のため、収入印紙は不要です。",
      "0123456789¥,.-−–—()（）:：/％%〒　 …",
      data.addressee,
      data.documentNumber,
      data.transactionDate,
      data.paymentMethodLabel,
      data.issuedDate,
      data.lineItems.map((item) => item.description).join(""),
      INVOICE_ISSUER.name,
      INVOICE_ISSUER.representativeName,
      INVOICE_ISSUER.address,
      INVOICE_ISSUER.postalCode,
      INVOICE_ISSUER.phone,
      INVOICE_ISSUER.email,
      INVOICE_REGISTRATION_NUMBER,
      "TELEmail",
    ].join("") + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@";
  const [subsetRegular, subsetBold] = await Promise.all([
    subsetFont(Buffer.from(regularBytes), usedChars, {
      targetFormat: "truetype",
    }),
    subsetFont(Buffer.from(boldBytes), usedChars, { targetFormat: "truetype" }),
  ]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(subsetRegular, { subset: false });
  const bold = await doc.embedFont(subsetBold, { subset: false });

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const rightX = PAGE_WIDTH - MARGIN_X;

  // タイトル
  drawTextCenter(page, "適　格　請　求　書", bold, 26, PAGE_HEIGHT - 96);

  // 右上: 発行日・請求書番号・登録番号
  drawTextRight(page, `発行日: ${data.issuedDate}`, font, 10, rightX, PAGE_HEIGHT - 64);
  drawTextRight(
    page,
    `請求書番号: ${data.documentNumber}`,
    font,
    10,
    rightX,
    PAGE_HEIGHT - 79,
  );
  drawTextRight(
    page,
    `登録番号: ${INVOICE_REGISTRATION_NUMBER}`,
    bold,
    10,
    rightX,
    PAGE_HEIGHT - 94,
  );

  // 宛名
  const addresseeY = PAGE_HEIGHT - 158;
  const addresseeText = `${data.addressee}　様`;
  page.drawText(addresseeText, {
    x: MARGIN_X,
    y: addresseeY,
    size: 16,
    font: bold,
    color: INK,
  });
  const addresseeWidth = bold.widthOfTextAtSize(addresseeText, 16);
  page.drawLine({
    start: { x: MARGIN_X, y: addresseeY - 6 },
    end: { x: MARGIN_X + Math.max(addresseeWidth, 220) + 12, y: addresseeY - 6 },
    thickness: 0.8,
    color: INK,
  });

  page.drawText("下記の通りご請求申し上げます。本請求書に係る代金はお支払い済みです。", {
    x: MARGIN_X,
    y: addresseeY - 28,
    size: 10,
    font,
    color: INK,
  });

  // 合計金額帯
  const amountBandY = PAGE_HEIGHT - 236;
  page.drawRectangle({
    x: MARGIN_X,
    y: amountBandY - 16,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 50,
    color: rgb(0.95, 0.97, 0.96),
    borderColor: ACCENT,
    borderWidth: 1.2,
  });
  page.drawText("合計金額", {
    x: MARGIN_X + 16,
    y: amountBandY,
    size: 12,
    font: bold,
    color: ACCENT,
  });
  drawTextCenter(
    page,
    `${formatYen(data.amountTotal)}-（税込）`,
    bold,
    22,
    amountBandY - 2,
  );

  // 明細テーブル
  const tableTop = amountBandY - 56;
  const colNameX = MARGIN_X;
  const colQtyRight = MARGIN_X + 316;
  const colUnitRight = MARGIN_X + 392;
  const colAmountRight = rightX;
  const nameMaxWidth = 296;

  // ヘッダー行
  page.drawRectangle({
    x: MARGIN_X,
    y: tableTop - 5,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 20,
    color: rgb(0.93, 0.93, 0.93),
  });
  page.drawText("品名", { x: colNameX + 4, y: tableTop, size: 9, font: bold, color: INK });
  drawTextRight(page, "数量", bold, 9, colQtyRight, tableTop);
  drawTextRight(page, "単価（税込）", bold, 9, colUnitRight, tableTop);
  drawTextRight(page, "金額（税込）", bold, 9, colAmountRight - 4, tableTop);

  let y = tableTop - 22;
  const rowHeight = 19;
  for (const item of data.lineItems) {
    const name = truncateToWidth(item.description, font, 10, nameMaxWidth);
    page.drawText(name, { x: colNameX + 4, y, size: 10, font, color: INK });
    drawTextRight(page, String(item.quantity), font, 10, colQtyRight, y);
    drawTextRight(
      page,
      item.unitAmount !== null ? formatYen(item.unitAmount) : "—",
      font,
      10,
      colUnitRight,
      y,
    );
    drawTextRight(page, formatYen(item.amountTotal), font, 10, colAmountRight - 4, y);
    page.drawLine({
      start: { x: MARGIN_X, y: y - 5 },
      end: { x: rightX, y: y - 5 },
      thickness: 0.5,
      color: RULE_LIGHT,
    });
    y -= rowHeight;
  }

  // 合計欄（右寄せの小計/消費税/合計）
  const { taxExcluded, tax } = splitTax(data.amountTotal);
  y -= 8;
  const summaryRows: Array<[string, string, PDFFont]> = [
    ["小計（税抜・10%対象）", formatYen(taxExcluded), font],
    ["消費税（10%）", formatYen(tax), font],
    ["合計（税込）", formatYen(data.amountTotal), bold],
  ];
  const summaryLabelX = MARGIN_X + 260;
  for (const [label, value, rowFont] of summaryRows) {
    page.drawText(label, { x: summaryLabelX, y, size: 10, font: rowFont, color: INK });
    drawTextRight(page, value, rowFont, 10, colAmountRight - 4, y);
    page.drawLine({
      start: { x: summaryLabelX, y: y - 5 },
      end: { x: rightX, y: y - 5 },
      thickness: 0.5,
      color: RULE,
    });
    y -= rowHeight;
  }

  // 取引情報（左側）
  let infoY = y - 8;
  const infoRows: Array<[string, string]> = [
    ["取引年月日", data.transactionDate],
    ["支払方法", `${data.paymentMethodLabel}（支払い済み）`],
  ];
  for (const [label, value] of infoRows) {
    page.drawText(label, { x: MARGIN_X, y: infoY, size: 10, font, color: INK });
    page.drawText(value, { x: MARGIN_X + 90, y: infoY, size: 10, font, color: INK });
    infoY -= 18;
  }

  // 発行者ブロック（右下）
  const issuerX = PAGE_WIDTH - MARGIN_X - 230;
  let issuerY = infoY - 24;
  page.drawText(`${INVOICE_ISSUER.name}（${INVOICE_ISSUER.representativeName}）`, {
    x: issuerX,
    y: issuerY,
    size: 12,
    font: bold,
    color: INK,
  });
  issuerY -= 17;
  const issuerLines = [
    `〒${INVOICE_ISSUER.postalCode} ${INVOICE_ISSUER.address}`,
    `TEL: ${INVOICE_ISSUER.phone}`,
    `Email: ${INVOICE_ISSUER.email}`,
    `登録番号: ${INVOICE_REGISTRATION_NUMBER}`,
  ];
  for (const line of issuerLines) {
    page.drawText(line, { x: issuerX, y: issuerY, size: 9, font, color: INK });
    issuerY -= 14;
  }

  // フッター注記
  const footerLines = [
    "本書類は消費税法第57条の4に基づく適格請求書です。",
    "電子的に発行された書類のため、収入印紙は不要です。",
  ];
  let footerY = 64;
  for (const line of footerLines) {
    page.drawText(line, {
      x: MARGIN_X,
      y: footerY,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    footerY -= 12;
  }

  return doc.save();
}
