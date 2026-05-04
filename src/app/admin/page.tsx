import { getCurrentAdmin } from "@/lib/admin-auth";

const SAMPLE_ORDERS = [
  {
    id: "—",
    orderedAt: "2026-05-04 13:55",
    model: "e-steer 20",
    customer: "(サンプル)",
    region: "—",
    amount: 1_150_000,
    status: "受注",
  },
  {
    id: "—",
    orderedAt: "2026-05-03 10:12",
    model: "e-steer 20 MAX",
    customer: "(サンプル)",
    region: "—",
    amount: 1_300_000,
    status: "入金待ち",
  },
];

function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-white">注文管理</h1>
        <p className="text-xs text-slate-500">
          ログイン中: {admin?.email ?? "—"}
        </p>
      </div>

      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 mb-6 text-sm text-amber-200">
        <p className="font-semibold mb-1">⚠ 開発中: Sheets連携待ち</p>
        <p className="text-xs leading-relaxed">
          Drive上の「EFIX販売管理」スプレッドシートのIDが <code>NEXT_PUBLIC_ADMIN_SHEET_ID</code> 環境変数で
          設定されると、ここに実際の注文データが表示されます。
          現在はサンプルデータを表示しています。
        </p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 border-b border-slate-800">
            <tr className="text-slate-400 text-left">
              <th className="px-4 py-3 font-semibold">通し番号</th>
              <th className="px-4 py-3 font-semibold">注文日時</th>
              <th className="px-4 py-3 font-semibold">モデル</th>
              <th className="px-4 py-3 font-semibold">顧客</th>
              <th className="px-4 py-3 font-semibold">地区</th>
              <th className="px-4 py-3 font-semibold text-right">金額(税込)</th>
              <th className="px-4 py-3 font-semibold">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {SAMPLE_ORDERS.map((order, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-800/40 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-slate-500">
                  {order.id}
                </td>
                <td className="px-4 py-3 text-slate-300">{order.orderedAt}</td>
                <td className="px-4 py-3 text-white font-semibold">
                  {order.model}
                </td>
                <td className="px-4 py-3 text-slate-300">{order.customer}</td>
                <td className="px-4 py-3 text-slate-400">{order.region}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                  {formatYen(order.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        ※ 在庫管理・卸アカウント管理・発注管理は段階的に追加予定（V2 §12 参照）。
      </p>
    </div>
  );
}
