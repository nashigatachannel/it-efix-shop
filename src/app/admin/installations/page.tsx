import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchInstallationReservations,
  fetchWebOrders,
  SPREADSHEET_ID,
  type InstallationReservationRow,
  type WebOrderRow,
} from "@/lib/sheets";
import InstallationRowEditor from "./InstallationRowEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface JoinedRow {
  reservation: InstallationReservationRow;
  order: WebOrderRow | null;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "希望日受領",
  proposing: "業者打診中",
  confirmed: "日程確定",
  installed: "取付完了",
  cancelled: "キャンセル",
};

function statusBadgeClass(status: string): string {
  if (status === "requested")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  if (status === "proposing")
    return "bg-sky-50 text-sky-700 border border-sky-200";
  if (status === "confirmed")
    return "bg-indigo-50 text-indigo-700 border border-indigo-200";
  if (status === "installed")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "cancelled")
    return "bg-red-50 text-red-700 border border-red-200";
  return "bg-neutral-100 text-neutral-600 border border-neutral-200";
}

export default async function AdminInstallationsPage() {
  const admin = await getCurrentAdmin();

  let reservations: InstallationReservationRow[] = [];
  let orders: WebOrderRow[] = [];
  let loadError: string | null = null;

  if (!SPREADSHEET_ID) {
    loadError = "GOOGLE_SPREADSHEET_ID が未設定です";
  } else {
    try {
      [reservations, orders] = await Promise.all([
        fetchInstallationReservations(),
        fetchWebOrders(),
      ]);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  const ordersBySessionId = new Map<string, WebOrderRow>();
  for (const order of orders) {
    if (order.sessionId) ordersBySessionId.set(order.sessionId, order);
  }

  const joined: JoinedRow[] = reservations.map((reservation) => ({
    reservation,
    order: ordersBySessionId.get(reservation.orderId) ?? null,
  }));

  const statusPriority: Record<string, number> = {
    requested: 0,
    proposing: 1,
    confirmed: 2,
    installed: 3,
    cancelled: 4,
  };
  joined.sort((a, b) => {
    const pa = statusPriority[a.reservation.status] ?? 99;
    const pb = statusPriority[b.reservation.status] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.order?.orderedAt ?? "";
    const db = b.order?.orderedAt ?? "";
    return db.localeCompare(da);
  });

  const counts = {
    requested: 0,
    proposing: 0,
    confirmed: 0,
    installed: 0,
    cancelled: 0,
    total: joined.length,
  };
  for (const j of joined) {
    const key = j.reservation.status as keyof typeof counts;
    if (key in counts && key !== "total") counts[key]++;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-neutral-950">取付日程管理</h1>
        <p className="text-xs text-neutral-500">
          ログイン中: {admin?.email ?? "—"}
        </p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
          <p className="font-semibold mb-1">⚠ Sheets読込失敗</p>
          <p className="text-xs leading-relaxed">{loadError}</p>
        </div>
      )}

      {!loadError && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(
            [
              ["requested", counts.requested],
              ["proposing", counts.proposing],
              ["confirmed", counts.confirmed],
              ["installed", counts.installed],
              ["cancelled", counts.cancelled],
            ] as const
          ).map(([key, count]) => (
            <div
              key={key}
              className="bg-white border border-neutral-200 rounded-lg p-4 text-center shadow-sm"
            >
              <div className="text-xs text-neutral-500">{STATUS_LABEL[key]}</div>
              <div className="text-2xl font-bold text-neutral-950 mt-1">{count}</div>
            </div>
          ))}
        </div>
      )}

      {!loadError && joined.length === 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-6 text-center text-neutral-500 shadow-sm">
          まだ取付予約はありません。決済成功時に自動で追加されます。
        </div>
      )}

      {joined.length > 0 && (
        <div className="space-y-4">
          {joined.map(({ reservation, order }) => {
            const isSample = reservation.orderId.startsWith("SAMPLE-");
            return (
              <div
                key={reservation.orderId}
                className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-neutral-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${statusBadgeClass(reservation.status)}`}
                      >
                        {STATUS_LABEL[reservation.status] ?? reservation.status}
                      </span>
                      {isSample && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-600">
                          サンプル行
                        </span>
                      )}
                      {!order && !isSample && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-50 text-red-700">
                          Web注文と未連携
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-950 font-semibold">
                      {order?.customerName || "顧客情報なし"}
                      {order?.customerPrefecture && (
                        <span className="text-neutral-500 text-xs ml-2">
                          {order.customerPrefecture}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-500 text-xs mt-0.5 font-mono break-all">
                      {reservation.orderId}
                    </div>
                    {order && (
                      <div className="text-neutral-600 text-xs mt-2 grid sm:grid-cols-2 gap-1">
                        <div>注文日時: {order.orderedAt || "—"}</div>
                        <div>モデル: {order.model || "—"}</div>
                        <div>連絡先: {order.customerPhone || order.customerEmail || "—"}</div>
                        <div>機種: {order.machineMaker} {order.machineModel}</div>
                      </div>
                    )}
                    {reservation.proposalHistory && (
                      <div className="text-neutral-700 text-xs mt-2 bg-neutral-50 border border-neutral-200 rounded p-2">
                        {reservation.proposalHistory}
                      </div>
                    )}
                  </div>
                </div>

                <InstallationRowEditor
                  orderId={reservation.orderId}
                  initialStatus={reservation.status}
                  initialConfirmedDate={reservation.confirmedDate}
                  initialVendorId={reservation.vendorId}
                  initialInstalledAt={reservation.installedAt}
                  initialReturnTrackingNumber={reservation.returnTrackingNumber}
                  initialNotes={reservation.notes}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-500">
        ※ 取付予約は Stripe 決済成功時(取付サービス利用注文のみ)に「取付予約」シートへ自動 INSERT される。
        担当業者ID は将来「協力業者」シートと連携予定(現状は手入力)。
      </p>
    </div>
  );
}
