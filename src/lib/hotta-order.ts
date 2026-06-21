import ExcelJS from "exceljs";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { INVOICE_ISSUER } from "@/lib/invoice-config";
import type { WholesaleCatalogItem } from "@/lib/wholesale-catalog";

interface HottaOrderLine {
  item: WholesaleCatalogItem;
  quantity: number;
}

interface HottaOrderCustomer {
  companyName: string;
  contactName?: string;
  email: string;
  phone: string;
  postalCode?: string;
  address?: string;
  desiredDeliveryDate?: string;
  machineModel?: string;
  notes?: string;
}

export interface SendHottaOrderInput {
  orderId: string;
  customer: HottaOrderCustomer;
  lines: HottaOrderLine[];
}

export interface HottaOrderSendResult {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  error?: string;
  to?: string;
  filename?: string;
}

const HOTTA_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "assets",
  "hotta-order-template.xlsx",
);

const HOTTA_ITEM_ROWS = [13, 14, 15, 16, 17];
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function gmailEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function nowJstDateLabel(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

function joinText(values: Array<string | undefined>): string {
  return values.map((value) => value?.trim()).filter(Boolean).join(" / ");
}

function appendRemarks(customer: HottaOrderCustomer, overflow: HottaOrderLine[]): string {
  const extras = overflow.map(
    ({ item, quantity }) =>
      `${item.shortName} ${item.partNumber || ""} x${quantity}`.trim(),
  );
  return joinText([
    customer.companyName ? `${customer.companyName} 分` : undefined,
    customer.machineModel ? `取付機種：【${customer.machineModel}】` : undefined,
    customer.notes,
    extras.length > 0 ? `追加明細: ${extras.join("、")}` : undefined,
  ]);
}

export async function buildHottaOrderWorkbook({
  orderId,
  customer,
  lines,
}: SendHottaOrderInput): Promise<{ buffer: Buffer; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(HOTTA_TEMPLATE_PATH);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("堀田機工注文書テンプレートにシートがありません。");
  }

  for (const sheet of [...workbook.worksheets].slice(1)) {
    workbook.removeWorksheet(sheet.id);
  }

  worksheet.name = "堀田機工注文書";
  worksheet.getCell("I3").value = nowJstDateLabel();
  worksheet.getCell("I4").value = `注文No.${orderId}`;
  worksheet.getCell("H5").value = INVOICE_ISSUER.name;
  worksheet.getCell("H6").value = INVOICE_ISSUER.representativeName;
  worksheet.getCell("H7").value = `〒${INVOICE_ISSUER.postalCode}`;
  worksheet.getCell("H8").value = INVOICE_ISSUER.address;
  worksheet.getCell("H9").value = INVOICE_ISSUER.phone;

  worksheet.getCell("C8").value = customer.companyName;
  worksheet.getCell("C9").value = customer.postalCode
    ? `〒${customer.postalCode}`
    : null;
  worksheet.getCell("C10").value = customer.address ?? null;
  worksheet.getCell("C11").value =
    joinText([customer.contactName, customer.phone]) || null;

  for (const row of HOTTA_ITEM_ROWS) {
    worksheet.getCell(`B${row}`).value = null;
    worksheet.getCell(`E${row}`).value = null;
    worksheet.getCell(`H${row}`).value = null;
    worksheet.getCell(`I${row}`).value = null;
    worksheet.getCell(`J${row}`).value = null;
  }

  const visibleLines = lines.slice(0, HOTTA_ITEM_ROWS.length);
  visibleLines.forEach(({ item, quantity }, index) => {
    const row = HOTTA_ITEM_ROWS[index];
    worksheet.getCell(`B${row}`).value = item.shortName;
    worksheet.getCell(`E${row}`).value = item.partNumber || null;
    worksheet.getCell(`H${row}`).value = quantity;
    worksheet.getCell(`I${row}`).value = customer.desiredDeliveryDate ?? null;
    worksheet.getCell(`J${row}`).value = null;
  });

  worksheet.getCell("C18").value = appendRemarks(
    customer,
    lines.slice(HOTTA_ITEM_ROWS.length),
  ) || null;

  const raw = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  return {
    buffer,
    filename: safeFilename(`堀田機工注文書_${orderId}.xlsx`),
  };
}

function encodeMimeWord(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress(name: string, email: string): string {
  return name ? `${encodeMimeWord(name)} <${email}>` : email;
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? value;
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildEmailBody(input: SendHottaOrderInput): string {
  const lines = input.lines.map(
    ({ item, quantity }) =>
      `- ${item.shortName} ${item.partNumber || ""} x${quantity}`.trim(),
  );
  return [
    "(有)堀田機工 ご担当者様",
    "",
    "いつもお世話になっております。IT 石川です。",
    "ブラケット注文書を添付いたします。",
    "",
    `注文番号: ${input.orderId}`,
    `販売店: ${input.customer.companyName}`,
    `担当者: ${input.customer.contactName || "-"}`,
    `取付機種: ${input.customer.machineModel || "-"}`,
    `納品先: ${joinText([input.customer.postalCode, input.customer.address]) || "-"}`,
    "",
    ...lines,
    "",
    "ご確認のほどよろしくお願いいたします。",
  ].join("\n");
}

function buildMimeMessage(params: {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  text: string;
  attachment: Buffer;
  filename: string;
}): string {
  const boundary = `efix-hotta-${randomUUID()}`;
  return [
    `From: ${formatAddress(params.fromName, params.fromEmail)}`,
    `To: ${params.toEmail}`,
    `Reply-To: ${params.fromEmail}`,
    `Subject: ${encodeMimeWord(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(params.text, "utf8").toString("base64")),
    "",
    `--${boundary}`,
    `Content-Type: ${XLSX_MIME}; name="${encodeMimeWord(params.filename)}"`,
    `Content-Disposition: attachment; filename="${encodeMimeWord(params.filename)}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(params.attachment.toString("base64")),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function sendHottaOrderEmail(
  input: SendHottaOrderInput,
): Promise<HottaOrderSendResult> {
  const toEmail = gmailEnv("HOTTA_ORDER_TO_EMAIL");
  const fromEmail =
    gmailEnv("HOTTA_ORDER_FROM_EMAIL") ||
    gmailEnv("GMAIL_USER") ||
    INVOICE_ISSUER.email;
  const clientId =
    gmailEnv("GMAIL_CLIENT_ID") || gmailEnv("GOOGLE_GMAIL_CLIENT_ID");
  const clientSecret =
    gmailEnv("GMAIL_CLIENT_SECRET") || gmailEnv("GOOGLE_GMAIL_CLIENT_SECRET");
  const refreshToken =
    gmailEnv("GMAIL_REFRESH_TOKEN") || gmailEnv("GOOGLE_GMAIL_REFRESH_TOKEN");

  if (!toEmail) {
    return {
      attempted: false,
      sent: false,
      skippedReason: "HOTTA_ORDER_TO_EMAIL が未設定です。",
    };
  }
  if (!clientId || !clientSecret || !refreshToken) {
    return {
      attempted: false,
      sent: false,
      skippedReason:
        "Gmail送信用の OAuth 環境変数が未設定です。GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN を設定してください。",
      to: toEmail,
    };
  }

  try {
    const { buffer, filename } = await buildHottaOrderWorkbook(input);
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: "v1", auth });
    const raw = buildMimeMessage({
      fromName: INVOICE_ISSUER.representativeName,
      fromEmail,
      toEmail,
      subject: `注文書送付の件（${input.orderId}）`,
      text: buildEmailBody(input),
      attachment: buffer,
      filename,
    });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: base64Url(raw) },
    });
    return { attempted: true, sent: true, to: toEmail, filename };
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      to: toEmail,
      error:
        error instanceof Error
          ? error.message
          : "堀田機工への注文書メール送信に失敗しました。",
    };
  }
}
