import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "ご注文ありがとうございます | E-FIX",
};

export default function SuccessPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-lg">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 mb-8"
            aria-hidden="true"
          >
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-4">
            ご注文ありがとうございます
          </h1>
          <p className="text-slate-400 leading-relaxed mb-8">
            決済が完了しました。ご登録のメールアドレス宛に確認メールをお送りします。
            <br />
            発送準備が整いましたら改めてご連絡いたします。
          </p>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-sm text-slate-400 mb-8 text-left">
            <p className="font-semibold text-slate-300 mb-2">お問い合わせ</p>
            <p>
              電話:{" "}
              <a href="tel:08062824834" className="text-emerald-400 hover:underline">
                080-6282-4834
              </a>
            </p>
            <p>
              メール:{" "}
              <a
                href="mailto:takuma.ishikawa.line@gmail.com"
                className="text-emerald-400 hover:underline"
              >
                takuma.ishikawa.line@gmail.com
              </a>
            </p>
          </div>
          <Link
            href="/"
            className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
          >
            トップページに戻る
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
