import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import subsetFont from "subset-font";
import {
  INVOICE_ISSUER,
  INVOICE_REGISTRATION_NUMBER,
} from "@/lib/invoice-config";

export interface ReceiptData {
  /** 領収書番号（注文番号ベース） */
  receiptNumber: string;
  /** 宛名（「様」は付けずに渡す） */
  addressee: string;
  /** 但し書き（「但し」「として」は付けずに渡す） */
  description: string;
  /** 税込金額（円） */
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

/**
 * 宛名入り領収書PDF（適格簡易請求書の記載要件を満たす）を生成する。
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(path.join(FONT_DIR, "ZenKakuGothicNew-Regular.ttf")),
    fs.readFile(path.join(FONT_DIR, "ZenKakuGothicNew-Bold.ttf")),
  ]);

  // 本文に登場しうる全文字 + 数字類をかき集めてフォントをサブセット化する。
  // fontkit(pdf-lib) の CJK サブセットはグリフ欠落バグがあるため、
  // harfbuzz ベースの subset-font で先に絞り込み、pdf-lib へはフル埋め込み扱いで渡す。
  const usedChars =
    [
      "領　収　書様金額税込但しとして上記の金額を正に領収いたしました。",
      "発行日領収書番号取引年月日支払方法抜対象消費合計",
      "本書類は消費税法第57条の4に基づく適格簡易請求書です。",
      "電子的に発行された領収書のため、収入印紙は不要です。",
      "0123456789¥,.-−–—()（）:：/％%〒　 ",
      data.addressee,
      data.description,
      data.receiptNumber,
      data.transactionDate,
      data.paymentMethodLabel,
      data.issuedDate,
      INVOICE_ISSUER.name,
      INVOICE_ISSUER.representativeName,
      INVOICE_ISSUER.address,
      INVOICE_ISSUER.postalCode,
      INVOICE_ISSUER.phone,
      INVOICE_ISSUER.email,
      INVOICE_REGISTRATION_NUMBER,
      "TELEmail登録番号",
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
  drawTextCenter(page, "領　収　書", bold, 28, PAGE_HEIGHT - 100);

  // 右上: 発行日・領収書番号
  drawTextRight(page, `発行日: ${data.issuedDate}`, font, 10, rightX, PAGE_HEIGHT - 70);
  drawTextRight(
    page,
    `領収書番号: ${data.receiptNumber}`,
    font,
    10,
    rightX,
    PAGE_HEIGHT - 85,
  );

  // 宛名
  const addresseeY = PAGE_HEIGHT - 170;
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

  // 金額（中央帯）
  const amountBandY = PAGE_HEIGHT - 260;
  page.drawRectangle({
    x: MARGIN_X,
    y: amountBandY - 16,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 52,
    color: rgb(0.95, 0.97, 0.96),
    borderColor: ACCENT,
    borderWidth: 1.2,
  });
  page.drawText("金額", {
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
    24,
    amountBandY - 2,
  );

  // 但し書き・受領文言
  let y = amountBandY - 60;
  page.drawText(`但し　${data.description}　として`, {
    x: MARGIN_X,
    y,
    size: 11,
    font,
    color: INK,
  });
  y -= 20;
  page.drawText("上記の金額を正に領収いたしました。", {
    x: MARGIN_X,
    y,
    size: 11,
    font,
    color: INK,
  });

  // 内訳（適格簡易請求書: 税率区分ごとの対価・税率・消費税額）
  const { taxExcluded, tax } = splitTax(data.amountTotal);
  y -= 44;
  const tableRows: Array<[string, string]> = [
    ["取引年月日", data.transactionDate],
    ["支払方法", data.paymentMethodLabel],
    ["税抜金額（10%対象）", formatYen(taxExcluded)],
    ["消費税額（10%）", formatYen(tax)],
    ["合計（税込）", formatYen(data.amountTotal)],
  ];
  const labelX = MARGIN_X;
  const valueRightX = MARGIN_X + 300;
  for (const [label, value] of tableRows) {
    page.drawText(label, { x: labelX, y, size: 10, font, color: INK });
    drawTextRight(page, value, font, 10, valueRightX, y);
    page.drawLine({
      start: { x: labelX, y: y - 5 },
      end: { x: valueRightX, y: y - 5 },
      thickness: 0.5,
      color: RULE,
    });
    y -= 22;
  }

  // 発行者ブロック（右下）
  const issuerX = PAGE_WIDTH - MARGIN_X - 220;
  let issuerY = y - 10;
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
    "本書類は消費税法第57条の4に基づく適格簡易請求書です。",
    "電子的に発行された領収書のため、収入印紙は不要です。",
  ];
  let footerY = 72;
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
