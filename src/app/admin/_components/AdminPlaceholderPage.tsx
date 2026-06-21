import Link from "next/link";
import { getCurrentAdmin } from "@/lib/admin-auth";

type AdminPlaceholderPageProps = {
  title: string;
  description: string;
  items: string[];
};

export default async function AdminPlaceholderPage({
  title,
  description,
  items,
}: AdminPlaceholderPageProps) {
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
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-600">
          {description}
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

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-neutral-950">管理予定項目</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-md border border-neutral-200 bg-[#fbfaf7] px-4 py-3 text-sm font-bold text-neutral-700"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
