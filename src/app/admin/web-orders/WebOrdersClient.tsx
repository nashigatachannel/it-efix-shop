"use client";

import { Fragment, useState } from "react";
import type { WebOrderRow } from "@/lib/sheets";
import { formatOrderModelSummary, parseOrderModelString } from "@/lib/order-lines";

function formatYen(n: number | null): string {
  if (n === null) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function statusLabel(row: WebOrderRow): string {
  if (row.paymentStatus === "paid") return "入金済";
  if (row.paymentStatus === "unpaid") return "入金待ち";
  if (row.paymentStatus === "payment_failed") return "支払い失敗";
  if (row.paymentStatus === "expired") return "期限切れ";
  if (row.paymentStatus === "canceled") return "キャンセル済み";
  return row.paymentStatus || "—";
}

function statusBadgeClass(row: WebOrderRow): string {
  if (row.paymentStatus === "paid") {
    return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40";
  }
  if (row.paymentStatus === "unpaid") {
    return "bg-amber-900/40 text-amber-300 border border-amber-700/40";
  }
  if (
    row.paymentStatus === "payment_failed" ||
    row.paymentStatus === "expired" ||
    row.paymentStatus === "canceled"
  ) {
    return "bg-red-900/30 text-red-300 border border-red-700/40";
  }
  return "bg-slate-800 text-slate-300";
}

function orderKey(order: WebOrderRow): string {
  return order.sessionId || `${order.serialNumber}-${order.orderedAt}`;
}

function displayValue(value: string): string {
  return value.trim() || "—";
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-200">{value}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="mb-3 text-xs font-black tracking-wide text-[#d1a227]">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function OrderDetailPanel({ order }: { order: WebOrderRow }) {
  const lines = parseOrderModelString(order.model);

  return (
    <div className="space-y-4 border-t border-slate-800 bg-slate-950/40 p-5">
      <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="mb-3 text-xs font-black tracking-wide text-[#d1a227]">
          購入商品
        </h3>
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">明細なし</p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((line, index) => (
              <li
                key={`${order.sessionId}-${index}-${line.raw}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span
                  className={
                    line.resolved
                      ? "text-slate-100"
                      : "text-amber-300"
                  }
                  title={line.resolved ? undefined : `未登録の商品ID: ${line.raw}`}
                >
                  {line.displayName}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  ×{line.quantity ?? 1}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailSection title="顧客情報">
          <DetailField label="氏名" value={displayValue(order.customerName)} />
          <DetailField label="メール" value={displayValue(order.customerEmail)} />
          <DetailField label="電話番号" value={displayValue(order.customerPhone)} />
          <DetailField
            label="郵便番号"
            value={order.customerPostalCode ? `〒${order.customerPostalCode}` : "—"}
          />
          <DetailField label="都道府県" value={displayValue(order.customerPrefecture)} />
          <DetailField label="住所" value={displayValue(order.customerAddress)} />
        </DetailSection>

        <DetailSection title="農機情報">
          <DetailField label="メーカー" value={displayValue(order.machineMaker)} />
          <DetailField label="機種" value={displayValue(order.machineModel)} />
        </DetailSection>

        <DetailSection title="取付情報">
          <DetailField label="取付区分" value={displayValue(order.installationLabel)} />
          <DetailField label="取付完了日" value={displayValue(order.installedAt)} />
          <DetailField
            label="希望日"
            value={
              [order.desiredDate1, order.desiredDate2, order.desiredDate3]
                .filter(Boolean)
                .join(" / ") || "—"
            }
          />
          <DetailField
            label="返送伝票番号"
            value={displayValue(order.returnTrackingNumber)}
          />
        </DetailSection>

        <DetailSection title="支払い・注文情報">
          <DetailField label="金額(税込)" value={formatYen(order.amountTotal)} />
          <DetailField label="決済方法" value={displayValue(order.paymentMethod)} />
          <DetailField
            label="ステータス"
            value={
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${statusBadgeClass(order)}`}
              >
                {statusLabel(order)}
              </span>
            }
          />
          <DetailField label="入金期限メモ" value={displayValue(order.paymentDueAt)} />
          <DetailField
            label="適格請求書"
            value={order.invoiceRequested ? "希望あり" : "希望なし"}
          />
          <DetailField label="通し番号" value={order.serialNumber ?? "—"} />
          <DetailField label="サブID" value={displayValue(order.subId)} />
          <DetailField label="注文日時" value={displayValue(order.orderedAt)} />
          <DetailField label="卸先ID" value={displayValue(order.partnerId)} />
          <DetailField
            label="Stripeセッション"
            value={
              <span className="break-all font-mono text-xs">
                {displayValue(order.sessionId)}
              </span>
            }
          />
        </DetailSection>
      </div>

      {order.notes && (
        <DetailSection title="備考">
          <div className="col-span-full whitespace-pre-wrap text-sm text-slate-200">
            {order.notes}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

export default function WebOrdersClient({
  orders,
  adminEmail,
  loadError,
}: {
  orders: WebOrderRow[];
  adminEmail: string;
  loadError: string | null;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function toggleExpanded(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  function handleRowKeyDown(
    event: React.KeyboardEvent<HTMLTableRowElement>,
    key: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleExpanded(key);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-white">注文管理（Web注文）</h1>
        <p className="text-xs text-slate-500">ログイン中: {adminEmail}</p>
      </div>

      {loadError && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6 text-sm text-red-200">
          <p className="font-semibold mb-1">⚠ Sheets読込失敗</p>
          <p className="text-xs leading-relaxed">{loadError}</p>
        </div>
      )}

      {!loadError && orders.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
          まだWeb注文はありません。
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-3 font-semibold">通し番号</th>
                <th className="px-4 py-3 font-semibold">注文日時</th>
                <th className="px-4 py-3 font-semibold">モデル</th>
                <th className="px-4 py-3 font-semibold">顧客</th>
                <th className="px-4 py-3 font-semibold">連絡先</th>
                <th className="px-4 py-3 font-semibold text-right">金額(税込)</th>
                <th className="px-4 py-3 font-semibold">決済</th>
                <th className="px-4 py-3 font-semibold">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.map((order) => {
                const key = orderKey(order);
                const expanded = expandedKey === key;
                const modelSummary = formatOrderModelSummary(order.model);
                return (
                  <Fragment key={key}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      aria-controls={`web-order-detail-${key}`}
                      onClick={() => toggleExpanded(key)}
                      onKeyDown={(event) => handleRowKeyDown(event, key)}
                      className={`cursor-pointer transition-colors hover:bg-slate-800/40 focus:outline-none focus-visible:bg-slate-800/50 ${
                        expanded ? "bg-slate-800/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-300">
                        <span className="mr-1 inline-block text-slate-600">
                          {expanded ? "▾" : "▸"}
                        </span>
                        {order.serialNumber ?? "—"}
                        {order.subId && (
                          <span className="text-slate-500 text-xs ml-1">
                            -{order.subId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.orderedAt || "—"}
                      </td>
                      <td className="px-4 py-3 text-white font-semibold">
                        <div
                          className="max-w-[220px] truncate"
                          title={modelSummary || undefined}
                        >
                          {modelSummary || "—"}
                        </div>
                        {order.machineMaker && (
                          <div className="text-slate-500 text-xs font-normal mt-0.5">
                            {order.machineMaker} {order.machineModel}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {order.customerName || "—"}
                        {order.customerAddress && (
                          <div className="text-slate-500 text-xs mt-0.5">
                            {order.customerAddress}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {order.customerEmail && <div>{order.customerEmail}</div>}
                        {order.customerPhone && <div>{order.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                        {formatYen(order.amountTotal)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {order.paymentMethod || "—"}
                        {order.invoiceRequested && (
                          <div className="text-amber-400 mt-0.5">適格請求書希望</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${statusBadgeClass(order)}`}
                        >
                          {statusLabel(order)}
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr id={`web-order-detail-${key}`}>
                        <td colSpan={8} className="p-0">
                          <OrderDetailPanel order={order} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        ※ 既存xlsx履歴データの移行・在庫管理・卸アカウント管理は段階的に追加予定（V2 §12 参照）。
      </p>
    </div>
  );
}
