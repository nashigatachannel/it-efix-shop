import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#eadfce] bg-[#fbf7ef]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="E-FIX ホーム">
          <span className="text-2xl font-black tracking-widest text-[#0b5c50]">
            E-FIX
          </span>
          <span className="hidden sm:block text-xs text-[#607069] border-l border-[#d8c9aa] pl-2 leading-tight">
            電動ステアリング
            <br />
            システム
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/order"
            className="text-sm font-bold text-[#0b806b] hover:text-[#c49a45] transition-colors"
          >
            注文する
          </Link>
          <Link
            href="/coverage"
            className="hidden text-sm font-semibold text-[#607069] hover:text-[#0b806b] transition-colors sm:inline"
          >
            基地局カバー
          </Link>
          <Link
            href="/orders/cancel"
            className="hidden text-sm font-semibold text-[#607069] hover:text-[#0b806b] transition-colors sm:inline"
          >
            注文キャンセル
          </Link>
          <Link
            href="/legal"
            className="hidden text-sm font-semibold text-[#607069] hover:text-[#0b806b] transition-colors md:inline"
          >
            特定商取引法に基づく表記
          </Link>
          <Link
            href="/partner/login"
            className="rounded-lg border border-[#0b806b]/50 bg-white px-3 py-2 text-xs font-bold text-[#0b806b] transition-colors hover:bg-[#0b806b] hover:text-white sm:text-sm"
          >
            販売店ログイン
          </Link>
        </nav>
      </div>
    </header>
  );
}
