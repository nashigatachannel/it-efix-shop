import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchInventoryMaster,
  fetchWebOrders,
  SPREADSHEET_ID,
  type InventoryMasterRow,
  type WebOrderRow,
} from "@/lib/sheets";
import { MAIN_PRODUCTS, type Product } from "@/lib/products";
import InventoryRowEditor from "./InventoryRowEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface InventoryViewModel {
  product: Product;
  master: InventoryMasterRow | null;
  allocated: number;
}

function countAllocated(productId: string, orders: WebOrderRow[]): number {
  let count = 0;
  for (const order of orders) {
    if (order.paymentStatus !== "paid") continue;
    if (order.installedAt && order.installedAt.trim()) continue;
    if (!order.model.includes(productId)) continue;
    count += 1;
  }
  return count;
}

export default async function AdminInventoryPage() {
  const admin = await getCurrentAdmin();

  let master: InventoryMasterRow[] = [];
  let orders: WebOrderRow[] = [];
  let loadError: string | null = null;

  if (!SPREADSHEET_ID) {
    loadError = "GOOGLE_SPREADSHEET_ID が未設定です";
  } else {
    try {
      [master, orders] = await Promise.all([
        fetchInventoryMaster(),
        fetchWebOrders(),
      ]);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Sheets読込エラー";
    }
  }

  const masterByProductId = new Map(
    master.map((row) => [row.productId, row] as const),
  );

  const viewModels: InventoryViewModel[] = MAIN_PRODUCTS.map((product) => ({
    product,
    master: masterByProductId.get(product.id) ?? null,
    allocated: countAllocated(product.id, orders),
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-black text-neutral-950">在庫管理</h1>
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

      <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-6 text-xs text-neutral-600 leading-relaxed shadow-sm">
        <p className="font-semibold text-neutral-950 mb-1">在庫マスタの読み方</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>
            <span className="text-neutral-800">現在庫数</span>: 物理的に手元/堀田機工/物流先にある台数。手動で調整する。
          </li>
          <li>
            <span className="text-neutral-800">引当数</span>:
            入金済かつ取付未完了の Web 注文台数。自動集計。
          </li>
          <li>
            <span className="text-neutral-800">販売可能数</span>:
            現在庫 − 引当数 と販売上限のうち小さい方。0 になると在庫切れ表示対象。
          </li>
          <li>
            <span className="text-neutral-800">販売上限</span>:
            例「初回ロット 10 台限定」のように上から押さえたい時に使う。0 で制限なし。
          </li>
        </ul>
        <p className="mt-2 text-neutral-500">
          ※ Phase 2 で BuyButton / OrderForm がこの「販売可能数」を見て購入ボタンを無効化する予定。現状は管理画面表示のみ。
        </p>
      </div>

      <div className="space-y-4">
        {viewModels.map(({ product, master, allocated }) => {
          const currentStock = master?.currentStock ?? 0;
          const salesLimit = master?.salesLimit ?? 0;
          const lastAdjustedAt = master?.lastAdjustedAt ?? "";
          const notes = master?.notes ?? "";
          const isUnregistered = master === null;

          return (
            <div
              key={product.id}
              className="bg-white border border-neutral-200 rounded-lg p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-neutral-200">
                <div>
                  <div className="text-neutral-950 font-bold text-lg">
                    {product.name}
                  </div>
                  <div className="text-neutral-500 text-xs mt-0.5 font-mono">
                    {product.id}
                  </div>
                </div>
                <div className="text-right text-xs text-neutral-500 space-y-0.5">
                  {isUnregistered ? (
                    <div className="text-amber-700">在庫マスタ未登録 - 保存で追加</div>
                  ) : (
                    <div>最終調整: {lastAdjustedAt || "—"}</div>
                  )}
                </div>
              </div>

              <InventoryRowEditor
                productId={product.id}
                initialCurrentStock={currentStock ?? 0}
                initialSalesLimit={salesLimit ?? 0}
                initialNotes={notes}
                allocated={allocated}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        ※ 引当数は Web 注文(paid かつ取付完了日が空)を集計したもの。
        卸注文/特価卸の引当は未集計(Phase 2 で対応)。
      </p>
    </div>
  );
}
