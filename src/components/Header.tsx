import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="E-FIX ホーム">
          <span className="text-2xl font-black tracking-widest text-emerald-400">
            E-FIX
          </span>
          <span className="hidden sm:block text-xs text-slate-400 border-l border-slate-600 pl-2 leading-tight">
            電動ステアリング
            <br />
            システム
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/order"
            className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            注文する
          </Link>
          <Link
            href="/legal"
            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
          >
            特定商取引法に基づく表記
          </Link>
        </nav>
      </div>
    </header>
  );
}
