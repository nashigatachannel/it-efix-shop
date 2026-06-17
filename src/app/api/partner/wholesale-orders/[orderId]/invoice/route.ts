import { NextResponse } from "next/server";
import {
  INVOICE_ISSUER,
  INVOICE_REGISTRATION_NUMBER,
} from "@/lib/invoice-config";
import { getCurrentPartner } from "@/lib/partner-auth";
import { fetchPartnerWholesaleOrderWithDetails } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function yen(value: number | null): string {
  if (value === null) return "";
  return `¥${value.toLocaleString("ja-JP")}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function filenameSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function dateOnly(value: string): string {
  return value.split(/\s+/)[0] || value;
}

function invoiceHtml(
  data: NonNullable<Awaited<ReturnType<typeof fetchPartnerWholesaleOrderWithDetails>>>,
): string {
  const { order, details } = data;
  const invoiceNumber = order.invoiceNumber || `INV-${order.orderId}`;
  const issuedAt = dateOnly(order.deliveredAt || order.updatedAt || order.orderedAt);
  const taxableSubtotal = order.subtotalExTax ?? 0;
  const tax = order.tax ?? Math.round(taxableSubtotal * 0.1);
  const total = order.totalIncTax ?? taxableSubtotal + tax;
  const rows =
    details.length > 0
      ? details
      : [
          {
            lineNo: 1,
            productName: order.detailText,
            partNumber: "",
            quantity: null,
            unitPriceExTax: null,
            subtotalExTax: order.subtotalExTax,
          },
        ];

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>請求書 ${escapeHtml(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2d2a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f6f3; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm; background: #fff; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0b806b; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 28px; letter-spacing: 0.12em; }
    .muted { color: #66736d; font-size: 12px; line-height: 1.7; }
    .issuer { text-align: right; font-size: 12px; line-height: 1.7; }
    .to { margin-top: 28px; display: grid; grid-template-columns: 1fr 220px; gap: 24px; }
    .customer { border-bottom: 1px solid #1f2d2a; padding-bottom: 8px; font-size: 18px; font-weight: 700; }
    .meta { width: 100%; border-collapse: collapse; font-size: 12px; }
    .meta th, .meta td { border: 1px solid #d8e1dc; padding: 7px 8px; text-align: left; }
    .total { margin-top: 28px; border: 2px solid #0b806b; padding: 14px 18px; display: flex; justify-content: space-between; align-items: baseline; }
    .total span { font-size: 14px; font-weight: 700; }
    .total strong { font-size: 28px; }
    table.lines { width: 100%; margin-top: 28px; border-collapse: collapse; font-size: 12px; }
    .lines th { background: #eef6f2; color: #24433b; }
    .lines th, .lines td { border: 1px solid #d8e1dc; padding: 9px 8px; vertical-align: top; }
    .right { text-align: right; }
    .summary { margin-left: auto; margin-top: 18px; width: 260px; border-collapse: collapse; font-size: 12px; }
    .summary th, .summary td { border: 1px solid #d8e1dc; padding: 8px; }
    .summary th { text-align: left; background: #fafafa; }
    .note { margin-top: 28px; font-size: 11px; color: #66736d; line-height: 1.8; }
    @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <h1>請求書</h1>
        <p class="muted">適格請求書 / Wholesale Invoice</p>
      </div>
      <div class="issuer">
        <strong>${escapeHtml(INVOICE_ISSUER.name)}</strong><br />
        ${escapeHtml(INVOICE_ISSUER.representativeName)}<br />
        〒${escapeHtml(INVOICE_ISSUER.postalCode)} ${escapeHtml(INVOICE_ISSUER.address)}<br />
        TEL: ${escapeHtml(INVOICE_ISSUER.phone)}<br />
        ${escapeHtml(INVOICE_ISSUER.email)}<br />
        登録番号: ${escapeHtml(INVOICE_REGISTRATION_NUMBER)}
      </div>
    </header>

    <section class="to">
      <div>
        <div class="customer">${escapeHtml(order.companyName)} 御中</div>
        <p class="muted">
          ご担当者: ${escapeHtml(order.contactName || "—")}<br />
          納品先: ${escapeHtml(order.deliveryAddress || "—")}
        </p>
      </div>
      <table class="meta">
        <tr><th>請求書番号</th><td>${escapeHtml(invoiceNumber)}</td></tr>
        <tr><th>受注番号</th><td>${escapeHtml(order.orderId)}</td></tr>
        <tr><th>発行日</th><td>${escapeHtml(issuedAt)}</td></tr>
        <tr><th>納品日</th><td>${escapeHtml(order.deliveredAt || "—")}</td></tr>
        <tr><th>支払条件</th><td>${escapeHtml(order.paymentTerms || "別途協議")}</td></tr>
      </table>
    </section>

    <section class="total">
      <span>ご請求金額（税込）</span>
      <strong>${escapeHtml(yen(total))}</strong>
    </section>

    <table class="lines">
      <thead>
        <tr>
          <th style="width: 44px;">No.</th>
          <th>品名</th>
          <th style="width: 96px;">品番</th>
          <th class="right" style="width: 72px;">数量</th>
          <th class="right" style="width: 110px;">単価(税抜)</th>
          <th class="right" style="width: 120px;">金額(税抜)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (line, index) => `<tr>
          <td>${escapeHtml(line.lineNo ?? index + 1)}</td>
          <td>${escapeHtml(line.productName || "—")}</td>
          <td>${escapeHtml(line.partNumber || "—")}</td>
          <td class="right">${escapeHtml(line.quantity ?? "")}</td>
          <td class="right">${escapeHtml(yen(line.unitPriceExTax ?? null))}</td>
          <td class="right">${escapeHtml(yen(line.subtotalExTax ?? null))}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>

    <table class="summary">
      <tr><th>小計（税抜）</th><td class="right">${escapeHtml(yen(taxableSubtotal))}</td></tr>
      <tr><th>消費税 10%</th><td class="right">${escapeHtml(yen(tax))}</td></tr>
      <tr><th>合計（税込）</th><td class="right"><strong>${escapeHtml(yen(total))}</strong></td></tr>
    </table>

    <p class="note">
      本書類は消費税法第57条の4に基づく適格請求書です。<br />
      請求内容に相違がある場合は、発行者までご連絡ください。
    </p>
  </main>
</body>
</html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const session = await getCurrentPartner();
  if (!session) {
    return NextResponse.json(
      { error: "ログインが必要です。" },
      { status: 401 },
    );
  }

  const { orderId } = await context.params;
  const decodedOrderId = decodeURIComponent(orderId ?? "").trim();
  if (!decodedOrderId) {
    return NextResponse.json(
      { error: "注文番号が指定されていません。" },
      { status: 400 },
    );
  }

  const data = await fetchPartnerWholesaleOrderWithDetails(
    session.partnerId,
    decodedOrderId,
  );
  if (!data) {
    return NextResponse.json(
      { error: "請求書対象の注文が見つかりません。" },
      { status: 404 },
    );
  }
  if (data.order.deliveryStatus !== "納品済み") {
    return NextResponse.json(
      { error: "納品済みの注文のみ請求書をダウンロードできます。" },
      { status: 409 },
    );
  }

  return new NextResponse(invoiceHtml(data), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="E-FIX_invoice_${filenameSafe(decodedOrderId)}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}
