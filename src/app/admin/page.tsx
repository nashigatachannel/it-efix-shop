import { getCurrentAdmin } from "@/lib/admin-auth";
import { fetchWebOrders, SPREADSHEET_ID, type WebOrderRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatYen(n: number | null): string {
  if (n === null) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function statusLabel(row: WebOrderRow): string {
  if (row.paymentStatus === "paid") return "入金済";
  if (row.paymentStatus === "unpaid") return "入金待ち";
  return row.paymentStatus || "—";
}

function statusBadgeClass(row: WebOrderRow): string {
  if (row.paymentStatus === "paid") {
    return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40";
  }
  if (row.paymentStatus === "unpaid") {
    return "bg-amber-900/40 text-amber-300 border border-amber-700/40";
  }
  return "bg-slate-800 text-slate-300";
}

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();

  let orders: WebOrderRow[] = [];
  let loadError: string | null = null;
  if (!SPREADSHEET_ID) {
    loadError = "GOOGLE_SPREADSHEET_ID が未設定です";
  } else {
    try {
      orders = await fetchWebOrders();
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  // 新しい順 (通し番号 desc, 注文日時 desc)
  orders.sort((a, b) => {
    const sa = a.serialNumber ?? 0;
    const sb = b.serialNumber ?? 0;
    if (sa !== sb) return sb - sa;
    return b.orderedAt.localeCompare(a.orderedAt);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-white">注文管理（Web注文）</h1>
        <p className="text-xs text-slate-500">
          ログイン中: {admin?.email ?? "—"}
        </p>
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
              {orders.map((order) => (
                <tr
                  key={order.sessionId || `${order.serialNumber}-${order.orderedAt}`}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-slate-300">
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
                    {order.model || "—"}
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
              ))}
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
