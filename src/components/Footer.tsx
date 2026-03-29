import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-700/50 bg-slate-900/60 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-lg font-black tracking-widest text-emerald-400">
              E-FIX
            </p>
            <p className="text-xs text-slate-500 mt-1">
              農機具電動ステアリングシステム
            </p>
          </div>
          <nav className="flex flex-col sm:flex-row gap-3 text-sm text-slate-400">
            <Link
              href="/legal"
              className="hover:text-emerald-400 transition-colors"
            >
              特定商取引法に基づく表記
            </Link>
          </nav>
        </div>
        <p className="text-xs text-slate-600 mt-6">
          &copy; {new Date().getFullYear()} IT 石川卓磨. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
