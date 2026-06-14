import type { Metadata } from "next";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

export const metadata: Metadata = {
  title: "E-FIX 管理画面",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2"
            aria-label="管理画面トップ"
          >
            <span className="text-xl font-black tracking-widest text-emerald-400">
              E-FIX
            </span>
            <span className="text-xs text-slate-500 border-l border-slate-700 pl-2">
              管理画面
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/admin"
              className="text-slate-300 hover:text-emerald-400"
            >
              注文一覧
            </Link>
            <Link
              href="/admin/wholesale"
              className="text-slate-300 hover:text-emerald-400"
            >
              卸注文
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
