import { redirect } from "next/navigation";
import { getCurrentPartner, fetchPartnerById } from "@/lib/partner-auth";
import { fetchPartnerOrders, type WebOrderRow } from "@/lib/sheets";
import PartnerOrderForm from "@/components/PartnerOrderForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatYen(n: number | null): string {
  if (n === null) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function statusLabel(o: WebOrderRow): string {
  if (o.paymentStatus === "paid") return "入金済";
  if (o.paymentStatus === "unpaid") return "入金待ち";
  return o.paymentStatus || "—";
}

function statusBadgeClass(o: WebOrderRow): string {
  if (o.paymentStatus === "paid") {
    return "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40";
  }
  if (o.paymentStatus === "unpaid") {
    return "bg-amber-900/40 text-amber-300 border border-amber-700/40";
  }
  return "bg-slate-800 text-slate-300";
}

export default async function PartnerPage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login");
  }
  const profile = await fetchPartnerById(session.partnerId);
  if (!profile) {
    // マスタから消えた / 無効化された
    redirect("/partner/login?next=/partner");
  }

  const tierLabel = profile.tier === "distributor" ? "特価卸" : "通常卸";
  const accent =
    profile.tier === "distributor" ? "text-amber-400" : "text-emerald-400";

  let orders: WebOrderRow[] = [];
  let ordersLoadError: string | null = null;
  try {
    orders = await fetchPartnerOrders(profile.partnerId);
    orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  } catch (err) {
    ordersLoadError = err instanceof Error ? err.message : "注文履歴の取得に失敗しました";
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xl font-black tracking-widest ${accent}`}>
              E-FIX
            </span>
            <span className="text-xs text-slate-500 border-l border-slate-700 pl-2">
              {tierLabel} / {profile.companyName}
            </span>
          </div>
          <form action="/api/partner/logout" method="post">
            <button
              type="submit"
              className="text-xs text-slate-400 hover:text-red-400"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">
            {profile.companyName} 様 ご発注
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            {tierLabel}価格でのご発注ページです。製品セットおよびオプション部品から数量をご指定ください。
          </p>
          <p className="mt-2 text-xs text-slate-500">
            ご担当者: {profile.contactName || "—"} ／ ID:{" "}
            <span className="font-mono">{profile.partnerId}</span>
          </p>
        </div>
        <PartnerOrderForm
          tier={profile.tier}
          tierLabel={tierLabel}
          defaults={{
            companyName: profile.companyName,
            contactName: profile.contactName,
            email: profile.email,
            phone: profile.phone,
            postalCode: profile.postalCode,
            address: profile.address,
          }}
        />

        <section className="mt-12">
          <h2 className={`text-xl font-bold ${accent} mb-4`}>
            ご注文履歴
          </h2>
          {ordersLoadError && (
            <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-sm text-red-300">
              {ordersLoadError}
            </div>
          )}
          {!ordersLoadError && orders.length === 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-400">
              まだご注文はありません。
            </div>
          )}
          {orders.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 border-b border-slate-800">
                  <tr className="text-slate-400 text-left">
                    <th className="px-4 py-3 font-semibold">注文日時</th>
                    <th className="px-4 py-3 font-semibold">商品</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      金額（税込）
                    </th>
                    <th className="px-4 py-3 font-semibold">支払期日</th>
                    <th className="px-4 py-3 font-semibold">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((o) => (
                    <tr
                      key={o.sessionId || `${o.serialNumber}-${o.orderedAt}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-300">
                        {o.orderedAt}
                      </td>
                      <td className="px-4 py-3 text-white">{o.model}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                        {formatYen(o.amountTotal)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {o.paymentDueAt || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${statusBadgeClass(o)}`}
                        >
                          {statusLabel(o)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-xs text-slate-500">
          ※ 決済完了後、適格請求書（登録番号 T2810703528253）が自動でメール送付されます。請求書PDFはご入力のメールアドレス宛に届きます。
        </p>
      </main>
    </div>
  );
}
