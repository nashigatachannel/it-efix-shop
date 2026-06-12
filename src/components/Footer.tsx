import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#eadfce] bg-white py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-lg font-black tracking-widest text-[#0b5c50]">
              E-FIX
            </p>
            <p className="text-xs text-[#607069] mt-1">
              農機具電動ステアリングシステム
            </p>
          </div>
          <nav className="flex flex-col sm:flex-row gap-3 sm:gap-5 text-sm font-semibold text-[#607069]">
            <Link
              href="/legal"
              className="hover:text-[#0b806b] transition-colors"
            >
              特定商取引法に基づく表記
            </Link>
            <Link
              href="/terms"
              className="hover:text-[#0b806b] transition-colors"
            >
              利用規約
            </Link>
            <Link
              href="/privacy"
              className="hover:text-[#0b806b] transition-colors"
            >
              プライバシーポリシー
            </Link>
          </nav>
        </div>
        <p className="text-xs text-[#88928d] mt-6">
          &copy; {new Date().getFullYear()} IT 石川卓磨. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
