import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "キャンセルしました | E-FIX",
};

export default function CancelPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-lg">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-700/40 border border-slate-600/40 mb-8"
            aria-hidden="true"
          >
            <span className="text-4xl text-slate-400">✕</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-4">
            キャンセルしました
          </h1>
          <p className="text-slate-400 leading-relaxed mb-8">
            決済をキャンセルしました。引き続きご検討ください。
            <br />
            ご不明な点がございましたらお気軽にお問い合わせください。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#products"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              製品一覧に戻る
            </Link>
            <Link
              href="/"
              className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              トップページへ
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
