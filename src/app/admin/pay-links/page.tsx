import { listUnpaidInvoiceRows, type UnpaidInvoiceRow } from "@/lib/sales-sheet";
import PayLinksClient from "./PayLinksClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPayLinksPage() {
  let rows: UnpaidInvoiceRow[] = [];
  let loadError: string | null = null;

  try {
    rows = await listUnpaidInvoiceRows();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "請求書データ読込エラー";
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-7 border-b-2 border-[#d1a227] pb-5">
        <h1 className="text-4xl font-black tracking-tight text-neutral-950">
          請求書カード払い
        </h1>
        <p className="mt-4 text-sm text-neutral-600">
          EFIX販売スプシ「シート1」でX列(INV番号)があり、G列(入金日)が空欄の未入金請求書一覧です。
          お客様に送付するカード決済リンクをここで生成できます。
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-black">請求書データ読込失敗</p>
          <p className="mt-2">{loadError}</p>
        </div>
      ) : (
        <PayLinksClient rows={rows} />
      )}
    </div>
  );
}
