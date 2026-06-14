import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchWholesaleOrders,
  WHOLESALE_SPREADSHEET_ID,
  type WholesaleOrderRow,
} from "@/lib/sheets";
import DeliveryStatusControl from "./DeliveryStatusControl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatYen(n: number | null): string {
  if (n === null) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function deliveryBadgeClass(order: WholesaleOrderRow): string {
  if (order.deliveryStatus === "納品済み") {
    return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40";
  }
  if (order.deliveryStatus === "キャンセル") {
    return "bg-red-900/30 text-red-300 border border-red-700/40";
  }
  return "bg-amber-900/40 text-amber-300 border border-amber-700/40";
}

function billingBadgeClass(order: WholesaleOrderRow): string {
  if (order.billingStatus === "請求済み" || order.billingStatus === "入金済み") {
    return "bg-sky-900/40 text-sky-300 border border-sky-700/40";
  }
  if (order.billingStatus === "キャンセル") {
    return "bg-red-900/30 text-red-300 border border-red-700/40";
  }
  return "bg-slate-800 text-slate-300 border border-slate-700";
}

export default async function AdminWholesaleOrdersPage() {
  const admin = await getCurrentAdmin();

  let orders: WholesaleOrderRow[] = [];
  let loadError: string | null = null;
  if (!WHOLESALE_SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    loadError = "Google Sheets保存先が未設定です。";
  } else {
    try {
      orders = await fetchWholesaleOrders();
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">卸注文管理</h1>
        </div>
        <p className="text-xs text-slate-500">
          ログイン中: {admin?.email ?? "—"}
        </p>
      </div>

      {loadError && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6 text-sm text-red-200">
          <p className="font-semibold mb-1">Sheets読込失敗</p>
          <p className="text-xs leading-relaxed">{loadError}</p>
        </div>
      )}

      {!loadError && orders.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
          まだ卸注文はありません。
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-900 border-b border-slate-800">
              <tr className="text-slate-400 text-left">
                <th className="px-4 py-3 font-semibold">受注番号</th>
                <th className="px-4 py-3 font-semibold">受注日時</th>
                <th className="px-4 py-3 font-semibold">卸先</th>
                <th className="px-4 py-3 font-semibold">商品明細</th>
                <th className="px-4 py-3 font-semibold text-right">合計(税込)</th>
                <th className="px-4 py-3 font-semibold">納品</th>
                <th className="px-4 py-3 font-semibold">請求</th>
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orders.map((order) => {
                const delivered = order.deliveryStatus === "納品済み";
                const isCanceled =
                  order.orderStatus.includes("キャンセル") ||
                  order.orderStatus.includes("取消");
                return (
                  <tr
                    key={order.orderId}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-200">
                        {order.orderId || "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {order.orderStatus || "—"} / {order.priceTier || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {order.orderedAt || "—"}
                      {order.desiredDeliveryDate && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          希望: {order.desiredDeliveryDate}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="font-semibold text-white">
                        {order.companyName || "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {order.contactName || "—"} / {order.partnerId || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs">
                      <div className="truncate">{order.detailText || "—"}</div>
                      {order.deliveryAddress && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {order.deliveryAddress}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                      {formatYen(order.totalIncTax)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${deliveryBadgeClass(order)}`}
                      >
                        {order.deliveryStatus || "未納品"}
                      </span>
                      {order.deliveredAt && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          {order.deliveredAt}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${billingBadgeClass(order)}`}
                      >
                        {order.billingStatus || "未請求"}
                      </span>
                      {order.billingMonth && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          {order.billingMonth}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isCanceled ? (
                        <span className="text-xs text-red-300">変更不可</span>
                      ) : (
                        <DeliveryStatusControl
                          orderId={order.orderId}
                          delivered={delivered}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
