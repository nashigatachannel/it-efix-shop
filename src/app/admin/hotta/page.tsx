import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchHottaWholesaleOrderHistory,
  WHOLESALE_SPREADSHEET_ID,
  type HottaWholesaleOrderHistoryRow,
} from "@/lib/sheets";
import HottaOrdersClient, {
  type HottaOrderEditorRow,
} from "./HottaOrdersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toEditorRow(
  history: HottaWholesaleOrderHistoryRow,
): HottaOrderEditorRow {
  const order = history.order;
  return {
    orderId: order.orderId,
    orderedAt: order.orderedAt,
    orderStatus: order.orderStatus,
    priceTier: order.priceTier,
    partnerId: order.partnerId,
    companyName: order.companyName,
    contactName: order.contactName,
    email: order.email,
    phone: order.phone,
    desiredDeliveryDate: order.desiredDeliveryDate,
    deliveryStatus: order.deliveryStatus,
    billingStatus: order.billingStatus || "価格確認中",
    machineModel: history.machineModel,
    notes: history.notes,
    itemSummary: history.itemSummary,
    details: history.details
      .filter((detail) => detail.lineNo !== null)
      .map((detail) => ({
        lineNo: detail.lineNo ?? 0,
        productName: detail.productName,
        quantity: detail.quantity ?? 0,
        unitPriceExTax: detail.unitPriceExTax,
        subtotalExTax: detail.subtotalExTax,
      })),
  };
}

export default async function AdminHottaOrdersPage() {
  const admin = await getCurrentAdmin();

  let histories: HottaWholesaleOrderHistoryRow[] = [];
  let loadError: string | null = null;
  if (!WHOLESALE_SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    loadError = "Google Sheets保存先が未設定です。";
  } else {
    try {
      histories = await fetchHottaWholesaleOrderHistory();
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  histories.sort((a, b) =>
    b.order.orderedAt.localeCompare(a.order.orderedAt),
  );

  return (
    <HottaOrdersClient
      adminEmail={admin?.email ?? "—"}
      initialRows={histories.map(toEditorRow)}
      loadError={loadError}
    />
  );
}
