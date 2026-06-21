import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminMenuItem = {
  title: string;
  subtitle: string;
  href: string;
  status: "ready" | "planned";
  accent: "gold" | "green" | "gray";
};

const menuItems: AdminMenuItem[] = [
  {
    title: "卸・特価卸の注文管理",
    subtitle: "卸注文、特価卸注文、納品状態、請求状態を確認します。",
    href: "/admin/wholesale",
    status: "ready",
    accent: "gold",
  },
  {
    title: "堀田機工の注文履歴",
    subtitle: "ブラケット注文、取付機種、備考、価格確認中の履歴を確認します。",
    href: "/admin/hotta",
    status: "ready",
    accent: "gold",
  },
  {
    title: "Web販売の注文管理",
    subtitle: "Web販売の注文、入金状態、顧客情報を確認します。",
    href: "/admin/web-orders",
    status: "ready",
    accent: "green",
  },
  {
    title: "Web販売の取付日程管理",
    subtitle: "取付希望日、確定日、返送状況を管理します。",
    href: "/admin/installations",
    status: "ready",
    accent: "green",
  },
  {
    title: "卸の価格・商品管理",
    subtitle: "卸向けの商品、価格、表示可否を管理します。",
    href: "/admin/catalog/wholesale",
    status: "planned",
    accent: "gray",
  },
  {
    title: "特価卸の価格・商品管理",
    subtitle: "特価卸向けの商品、特別価格、販売条件を管理します。",
    href: "/admin/catalog/special-wholesale",
    status: "planned",
    accent: "gray",
  },
  {
    title: "Web販売の価格・在庫管理",
    subtitle: "販売価格、在庫数、台数限定、販売停止を管理します。",
    href: "/admin/catalog/web",
    status: "ready",
    accent: "gold",
  },
];

function MenuIcon({ accent }: { accent: AdminMenuItem["accent"] }) {
  const color =
    accent === "gold" ? "text-[#c89518]" : accent === "green" ? "text-emerald-600" : "text-neutral-500";
  return (
    <svg
      className={`h-10 w-10 ${color}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 4h7v7H4z" />
      <path d="M13 4h7v7h-7z" />
      <path d="M4 13h7v7H4z" />
      <path d="M13 13h7v7h-7z" />
    </svg>
  );
}

function MenuCard({ item }: { item: AdminMenuItem }) {
  const ready = item.status === "ready";
  return (
    <Link
      href={item.href}
      className="group flex min-h-[190px] flex-col justify-between rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d1a227] hover:shadow-md"
    >
      <div>
        <div className="mb-5 flex items-center justify-between">
          <MenuIcon accent={item.accent} />
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              ready
                ? "bg-emerald-50 text-emerald-700"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {ready ? "利用可" : "準備中"}
          </span>
        </div>
        <h2 className="text-xl font-black tracking-tight text-neutral-950 group-hover:text-[#a77806]">
          {item.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {item.subtitle}
        </p>
      </div>
      <div className="mt-6 text-sm font-bold text-[#b48513]">
        開く
      </div>
    </Link>
  );
}

export default async function AdminHomePage() {
  const admin = await getCurrentAdmin();

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="mb-8 border-b-2 border-[#d1a227] pb-5">
        <h1 className="text-4xl font-black tracking-tight text-neutral-950">
          管理トップ
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {menuItems.map((item) => (
          <MenuCard key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
