import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPartner, fetchPartnerById } from "@/lib/partner-auth";
import {
  fetchPartnerOrders,
  fetchPartnerWholesaleOrders,
  type WebOrderRow,
  type WholesaleOrderRow,
} from "@/lib/sheets";

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
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (o.paymentStatus === "unpaid") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  return "bg-stone-100 text-stone-600 border border-stone-200";
}

function deliveryStatusBadgeClass(o: WholesaleOrderRow): string {
  if (o.deliveryStatus === "納品済み") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (o.deliveryStatus === "キャンセル") {
    return "bg-red-50 text-red-700 border border-red-200";
  }
  return "bg-amber-50 text-amber-700 border border-amber-200";
}

function orderTotal(orders: WebOrderRow[]): number {
  return orders.reduce((sum, order) => sum + (order.amountTotal ?? 0), 0);
}

export default async function PartnerPage() {
  const session = await getCurrentPartner();
  if (!session) {
    redirect("/partner/login");
  }

  const profile = await fetchPartnerById(session.partnerId);
  if (!profile) {
    redirect("/partner/login?next=/partner");
  }

  const tierLabel = profile.tier === "distributor" ? "特価卸" : "通常卸";
  const accent =
    profile.tier === "distributor" ? "text-amber-600" : "text-emerald-700";
  const buttonColor =
    profile.tier === "distributor"
      ? "bg-amber-600 hover:bg-amber-500"
      : "bg-emerald-700 hover:bg-emerald-600";
  const eSteer20Href =
    profile.tier === "distributor"
      ? "/wholesale/special/esteer20"
      : "/wholesale/esteer20";
  const eSteer10Href =
    profile.tier === "distributor"
      ? "/wholesale/special/esteer10"
      : "/wholesale/esteer10";

  let orders: WebOrderRow[] = [];
  let ordersLoadError: string | null = null;
  let wholesaleOrders: WholesaleOrderRow[] = [];
  let wholesaleOrdersLoadError: string | null = null;
  try {
    orders = await fetchPartnerOrders(profile.partnerId);
    orders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  } catch (err) {
    ordersLoadError =
      err instanceof Error ? err.message : "注文履歴の取得に失敗しました";
  }
  try {
    wholesaleOrders = await fetchPartnerWholesaleOrders(profile.partnerId);
    wholesaleOrders.sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
  } catch (err) {
    wholesaleOrdersLoadError =
      err instanceof Error ? err.message : "卸注文履歴の取得に失敗しました";
  }

  const recentOrders = orders.slice(0, 8);
  const recentWholesaleOrders = wholesaleOrders.slice(0, 12);

  return (
    <div className="min-h-screen bg-[#f7faf6] text-stone-950">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className={`text-2xl font-black tracking-widest ${accent}`}>
              E-FIX
            </span>
            <span className="border-l border-stone-200 pl-3 text-xs font-semibold text-stone-500">
              販売店ページ
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-stone-500 sm:inline">
              efix-shop.jp
            </span>
            <form action="/api/partner/logout" method="post">
              <button
                type="submit"
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <p className={`text-sm font-bold ${accent}`}>{tierLabel}</p>
          <h1 className="mt-2 text-3xl font-black">
            {profile.companyName} 様
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            販売店様向けの注文入口です。現行機の eSteer 20 / 20MAX と、旧型の
            eSteer 10 を分けて注文できます。請求書は納品日時に合わせて別途作成します。
          </p>
          <p className="mt-2 text-xs text-stone-500">
            ご担当者: {profile.contactName || "—"} / 販売店ID:{" "}
            <span className="font-mono">{profile.partnerId}</span>
          </p>
        </section>

        <section className="hidden">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-stone-500">注文履歴</p>
            <p className="mt-2 text-3xl font-black">{orders.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-stone-500">履歴合計</p>
            <p className={`mt-2 font-mono text-3xl font-black ${accent}`}>
              {formatYen(orderTotal(orders))}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-stone-500">ログインURL</p>
            <p className="mt-2 break-all font-mono text-sm text-stone-700">
              efix-shop.jp/partner/login
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href={eSteer20Href}
            className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-emerald-700">
              CURRENT MODEL
            </p>
            <h2 className="mt-3 text-2xl font-black">
              eSteer 20 / 20MAX 注文
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              現行機の本体、標準部品、オプション、国産ブラケットを注文します。
            </p>
            <span
              className={`mt-5 inline-flex rounded-md px-4 py-2 text-sm font-bold text-white ${buttonColor}`}
            >
              現行機ページへ
            </span>
          </Link>

          <Link
            href={eSteer10Href}
            className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-stone-500">
              LEGACY MODEL
            </p>
            <h2 className="mt-3 text-2xl font-black">eSteer 10 注文</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              旧型機の本体、対応部品、共用部品を20/20MAXと分けて注文します。
            </p>
            <span className="mt-5 inline-flex rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700">
              旧型ページへ
            </span>
          </Link>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={`text-sm font-bold ${accent}`}>WHOLESALE ORDERS</p>
              <h2 className="mt-1 text-2xl font-black">卸注文履歴</h2>
            </div>
            <p className="text-xs text-stone-500">
              {wholesaleOrders.length}件
            </p>
          </div>

          {wholesaleOrdersLoadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {wholesaleOrdersLoadError}
            </div>
          )}

          {!wholesaleOrdersLoadError && recentWholesaleOrders.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-stone-500 shadow-sm">
              まだ卸注文はありません。
            </div>
          )}

          {recentWholesaleOrders.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold text-stone-500">
                    <tr>
                      <th className="px-4 py-3">受注日時</th>
                      <th className="px-4 py-3">受注番号</th>
                      <th className="px-4 py-3">商品明細</th>
                      <th className="px-4 py-3 text-right">合計（税込）</th>
                      <th className="px-4 py-3">納品</th>
                      <th className="px-4 py-3">請求書</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {recentWholesaleOrders.map((order) => {
                      const delivered = order.deliveryStatus === "納品済み";
                      return (
                        <tr
                          key={order.orderId}
                          className="transition-colors hover:bg-emerald-50/40"
                        >
                          <td className="px-4 py-3 text-stone-600">
                            {order.orderedAt || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-stone-700">
                            {order.orderId}
                          </td>
                          <td className="px-4 py-3 font-semibold text-stone-900">
                            {order.detailText || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-700">
                            {formatYen(order.totalIncTax)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-xs ${deliveryStatusBadgeClass(
                                order,
                              )}`}
                            >
                              {order.deliveryStatus || "未納品"}
                            </span>
                            {order.deliveredAt && (
                              <div className="mt-1 text-[11px] text-stone-500">
                                {order.deliveredAt}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {delivered ? (
                              <a
                                href={`/api/partner/wholesale-orders/${encodeURIComponent(
                                  order.orderId,
                                )}/invoice`}
                                className="inline-flex rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-600"
                              >
                                請求書DL
                              </a>
                            ) : (
                              <span className="inline-flex rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-400">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <details className="group mt-12">
          <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-end justify-between gap-3 rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 [&::-webkit-details-marker]:hidden">
            <div>
              <p className={`text-sm font-bold ${accent}`}>ORDER HISTORY</p>
              <h2 className="mt-1 text-2xl font-black">注文履歴</h2>
            </div>
            <p className="text-xs text-stone-500">
              決済注文の履歴を新しい順に表示します。
            </p>
            <span className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-bold text-white group-open:hidden">
              履歴を表示
            </span>
            <span className="hidden rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700 group-open:inline-flex">
              閉じる
            </span>
          </summary>

          <div className="space-y-4">

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-stone-500">注文履歴</p>
              <p className="mt-2 text-3xl font-black">{orders.length}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-stone-500">履歴合計</p>
              <p className={`mt-2 font-mono text-3xl font-black ${accent}`}>
                {formatYen(orderTotal(orders))}
              </p>
            </div>
          </div>

          {ordersLoadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {ordersLoadError}
            </div>
          )}

          {!ordersLoadError && recentOrders.length === 0 && (
            <div className="rounded-lg border border-stone-200 bg-white p-6 text-center text-stone-500 shadow-sm">
              まだ注文はありません。
            </div>
          )}

          {recentOrders.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-xs font-bold text-stone-500">
                    <tr>
                      <th className="px-4 py-3">注文日時</th>
                      <th className="px-4 py-3">商品</th>
                      <th className="px-4 py-3 text-right">金額（税込）</th>
                      <th className="px-4 py-3">支払期日</th>
                      <th className="px-4 py-3">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {recentOrders.map((order) => (
                      <tr
                        key={
                          order.sessionId ||
                          `${order.serialNumber}-${order.orderedAt}`
                        }
                        className="transition-colors hover:bg-emerald-50/40"
                      >
                        <td className="px-4 py-3 text-stone-600">
                          {order.orderedAt}
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900">{order.model}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700">
                          {formatYen(order.amountTotal)}
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {order.paymentDueAt || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-xs ${statusBadgeClass(
                              order,
                            )}`}
                          >
                            {statusLabel(order)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        </details>
      </main>
    </div>
  );
}
