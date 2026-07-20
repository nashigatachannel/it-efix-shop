import { getCurrentAdmin } from "@/lib/admin-auth";
import { fetchWebOrders, SPREADSHEET_ID, type WebOrderRow } from "@/lib/sheets";
import WebOrdersClient from "./WebOrdersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <WebOrdersClient
      orders={orders}
      adminEmail={admin?.email ?? "—"}
      loadError={loadError}
    />
  );
}
