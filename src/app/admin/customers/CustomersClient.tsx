"use client";

import { useMemo, useState } from "react";
import type { AdminCustomerKind, AdminCustomerRow } from "@/lib/admin-customers";

type CustomerFilter = "all" | "web" | "partner";

const filterLabels: Record<CustomerFilter, string> = {
  all: "すべて",
  web: "顧客",
  partner: "卸・特価卸",
};

function formatYen(n: number): string {
  if (!n) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function kindLabel(kind: AdminCustomerKind): string {
  if (kind === "web") return "Web顧客";
  if (kind === "wholesale") return "通常卸";
  if (kind === "distributor") return "特価卸";
  return "複合";
}

function kindBadgeClass(kind: AdminCustomerKind): string {
  if (kind === "web") return "bg-emerald-50 text-emerald-700";
  if (kind === "wholesale") return "bg-[#fbf4df] text-[#9a700d]";
  if (kind === "distributor") return "bg-sky-50 text-sky-700";
  return "bg-violet-50 text-violet-700";
}

function statusLabel(status: string): string {
  if (!status) return "—";
  if (status === "paid") return "入金済";
  if (status === "unpaid") return "入金待ち";
  if (status === "payment_failed") return "支払い失敗";
  if (status === "expired") return "期限切れ";
  if (status === "canceled") return "キャンセル済み";
  return status;
}

function isPartnerCustomer(customer: AdminCustomerRow): boolean {
  return (
    customer.kind === "wholesale" ||
    customer.kind === "distributor" ||
    customer.kind === "mixed"
  );
}

function filterCustomers(
  customers: AdminCustomerRow[],
  filter: CustomerFilter,
): AdminCustomerRow[] {
  if (filter === "web") {
    return customers.filter((customer) => customer.kind === "web");
  }
  if (filter === "partner") {
    return customers.filter(isPartnerCustomer);
  }
  return customers;
}

function tableLeadLabel(filter: CustomerFilter): string {
  if (filter === "web") return "顧客";
  if (filter === "partner") return "卸先 / 会社";
  return "顧客 / 卸先";
}

function emptyMessage(filter: CustomerFilter): string {
  if (filter === "web") return "Web顧客データはまだありません";
  if (filter === "partner") return "卸・特価卸のデータはまだありません";
  return "顧客データはまだありません";
}

function CustomerTable({
  customers,
  filter,
}: {
  customers: AdminCustomerRow[];
  filter: CustomerFilter;
}) {
  if (customers.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-black text-neutral-950">
          {emptyMessage(filter)}
        </h2>
        <p className="mt-3 text-sm text-neutral-600">
          Web注文、卸注文、販売店マスタのいずれかにデータが入るとここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="bg-[#fbf5e8]">
          <tr className="border-b border-neutral-200 text-left text-neutral-700">
            <th className="w-64 px-4 py-3 font-black">
              {tableLeadLabel(filter)}
            </th>
            <th className="w-28 px-4 py-3 font-black">区分</th>
            <th className="w-64 px-4 py-3 font-black">連絡先</th>
            <th className="w-80 px-4 py-3 font-black">住所</th>
            <th className="w-28 px-4 py-3 text-right font-black">注文数</th>
            <th className="w-32 px-4 py-3 text-right font-black">累計金額</th>
            <th className="w-40 px-4 py-3 font-black">最新注文</th>
            <th className="w-36 px-4 py-3 font-black">状態</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.key}
              className="border-b border-neutral-100 last:border-b-0"
            >
              <td className="px-4 py-4">
                <div className="font-black text-neutral-950">
                  {customer.companyName || customer.name || "—"}
                </div>
                {customer.contactName && (
                  <div className="mt-1 text-xs font-bold text-neutral-500">
                    担当: {customer.contactName}
                  </div>
                )}
                {customer.partnerId && (
                  <div className="mt-1 font-mono text-xs text-neutral-500">
                    {customer.partnerId}
                  </div>
                )}
              </td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex rounded-md px-3 py-1 text-xs font-black ${kindBadgeClass(
                    customer.kind,
                  )}`}
                >
                  {kindLabel(customer.kind)}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {customer.sources.map((source) => (
                    <span
                      key={source}
                      className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-bold text-neutral-500"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4 text-neutral-700">
                <div>{customer.email || "—"}</div>
                <div className="mt-1">{customer.phone || "—"}</div>
              </td>
              <td className="px-4 py-4 text-neutral-700">
                {customer.postalCode && (
                  <div className="font-bold">〒{customer.postalCode}</div>
                )}
                <div className="mt-1 leading-relaxed">
                  {customer.address || "—"}
                </div>
              </td>
              <td className="px-4 py-4 text-right font-mono text-neutral-800">
                {customer.orderCount}
                <div className="mt-1 text-[11px] text-neutral-500">
                  Web {customer.webOrderCount} / 卸 {customer.wholesaleOrderCount}
                </div>
              </td>
              <td className="px-4 py-4 text-right font-mono font-bold text-neutral-800">
                {formatYen(customer.totalAmount)}
              </td>
              <td className="px-4 py-4 text-neutral-700">
                {customer.latestOrderAt || "—"}
              </td>
              <td className="px-4 py-4 text-neutral-700">
                {statusLabel(customer.latestStatus)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomersClient({
  customers,
  orderCount,
}: {
  customers: AdminCustomerRow[];
  orderCount: number;
}) {
  const [filter, setFilter] = useState<CustomerFilter>("web");
  const filteredCustomers = useMemo(
    () => filterCustomers(customers, filter),
    [customers, filter],
  );
  const counts = useMemo(
    () => ({
      all: customers.length,
      web: filterCustomers(customers, "web").length,
      partner: filterCustomers(customers, "partner").length,
    }),
    [customers],
  );

  return (
    <>
      <div className="mb-5 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-black text-neutral-950">
            顧客一覧{" "}
            <span className="text-base font-bold text-neutral-600">
              （{filteredCustomers.length}件 / 全{customers.length}件 / 注文 {orderCount}件）
            </span>
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Web顧客と卸先を切り替えて確認できます。
          </p>
        </div>
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1.5 shadow-sm">
            {(["all", "web", "partner"] as const).map((item) => {
              const active = filter === item;
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`customer-filter-${item}`}
                  onClick={() => setFilter(item)}
                  className={`min-w-32 rounded-lg px-6 py-3 text-base font-black transition ${
                    active
                      ? "bg-[#d1a227] text-white shadow-sm"
                      : "text-neutral-600 hover:bg-[#fbf4df] hover:text-[#9a700d]"
                  }`}
                >
                  {filterLabels[item]}
                  <span className="ml-2 text-sm opacity-80">{counts[item]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <CustomerTable customers={filteredCustomers} filter={filter} />
    </>
  );
}
