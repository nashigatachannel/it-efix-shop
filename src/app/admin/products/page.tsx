import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductAction = {
  title: string;
  description: string;
  href: string;
  status: "利用可" | "準備中";
  icon: "web" | "wholesale" | "special";
};

const productActions: ProductAction[] = [
  {
    title: "Web販売価格の更新",
    description: "Web販売サイトに表示する価格、在庫数、販売上限、Stripe IDを管理します。",
    href: "/admin/catalog/web",
    status: "利用可",
    icon: "web",
  },
  {
    title: "卸価格の更新",
    description: "通常卸向けの商品価格、表示可否、卸条件を管理します。",
    href: "/admin/catalog/wholesale",
    status: "準備中",
    icon: "wholesale",
  },
  {
    title: "特価卸の更新",
    description: "特価卸向けの商品価格、特別条件、販売可否を管理します。",
    href: "/admin/catalog/special-wholesale",
    status: "準備中",
    icon: "special",
  },
];

function ProductIcon({ icon }: { icon: ProductAction["icon"] }) {
  const common = {
    className: "h-12 w-12 text-[#c89518]",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  if (icon === "web") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  if (icon === "wholesale") {
    return (
      <svg {...common}>
        <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M20 13 13 20 4 11V4h7l9 9Z" />
      <circle cx="8" cy="8" r="1.2" />
      <path d="M15 8h.01" />
      <path d="M17 10h.01" />
    </svg>
  );
}

function ProductActionCard({ item }: { item: ProductAction }) {
  const ready = item.status === "利用可";

  return (
    <Link
      href={item.href}
      className="group flex min-h-[230px] flex-col justify-between rounded-lg border border-neutral-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d1a227] hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <ProductIcon icon={item.icon} />
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              ready
                ? "bg-emerald-50 text-emerald-700"
                : "bg-[#fbf4df] text-[#9a700d]"
            }`}
          >
            {item.status}
          </span>
        </div>
        <h2 className="mt-6 text-2xl font-black tracking-tight text-neutral-950 group-hover:text-[#a77806]">
          {item.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          {item.description}
        </p>
      </div>
      <div className="mt-8 inline-flex w-fit items-center gap-2 rounded-md border border-[#d1a227] px-5 py-3 text-sm font-black text-[#b48513] transition group-hover:bg-[#fbf4df]">
        開く
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}

export default async function AdminProductsPage() {
  const admin = await getCurrentAdmin();

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-8 border-b-2 border-[#d1a227] pb-5">
        <Link
          href="/admin"
          className="text-sm font-bold text-[#b48513] hover:text-[#8a6206]"
        >
          管理トップへ戻る
        </Link>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-neutral-950">
          商品管理
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-600">
          商品価格の管理先を選択します。Web販売、通常卸、特価卸を分けて更新できます。
        </p>
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

      <div className="grid gap-5 lg:grid-cols-3">
        {productActions.map((item) => (
          <ProductActionCard key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
