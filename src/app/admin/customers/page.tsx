import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  fetchAdminCustomers,
  type AdminCustomerRow,
} from "@/lib/admin-customers";
import CustomersClient from "./CustomersClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatYen(n: number): string {
  if (!n) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-neutral-950">{value}</p>
    </div>
  );
}

export default async function AdminCustomersPage() {
  const admin = await getCurrentAdmin();
  let customers: AdminCustomerRow[] = [];
  let loadError: string | null = null;

  try {
    customers = await fetchAdminCustomers();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "顧客データ読込エラー";
  }

  const webCount = customers.filter((customer) =>
    customer.sources.includes("Web販売"),
  ).length;
  const partnerCount = customers.filter((customer) =>
    customer.sources.some((source) => source.includes("卸")),
  ).length;
  const orderCount = customers.reduce(
    (sum, customer) => sum + customer.orderCount,
    0,
  );
  const totalAmount = customers.reduce(
    (sum, customer) => sum + customer.totalAmount,
    0,
  );

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-7 border-b-2 border-[#d1a227] pb-5">
        <h1 className="text-4xl font-black tracking-tight text-neutral-950">
          顧客管理
        </h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-600">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="8" r="4" />
          </svg>
          ログイン中: {admin?.email ?? "-"}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="顧客数" value={customers.length} />
        <StatCard label="Web顧客" value={webCount} />
        <StatCard label="卸・特価卸" value={partnerCount} />
        <StatCard label="累計注文金額" value={formatYen(totalAmount)} />
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-neutral-950">接続元</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            "EFIX 注文DB / Web注文",
            "EFIX 注文DB / 卸注文管理",
            "EFIX 販売 / 通常卸一覧・特価卸一覧",
            "EFIX 注文DB / 顧客マスタ（同期予定）",
          ].map((source) => (
            <div
              key={source}
              className="rounded-md border border-neutral-200 bg-[#fbfaf7] px-4 py-3 text-sm font-bold text-neutral-700"
            >
              {source}
            </div>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-black">顧客データ読込失敗</p>
          <p className="mt-2">{loadError}</p>
        </div>
      ) : (
        <CustomersClient customers={customers} orderCount={orderCount} />
      )}
    </div>
  );
}
