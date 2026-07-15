import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "お支払い完了 | E-FIX",
  robots: { index: false, follow: false },
};

export default function PaySuccessPage() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-lg">
          <div
            className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full border border-[#0b806b]/30 bg-[#eef7f3]"
            aria-hidden="true"
          >
            <span className="text-4xl text-[#0b806b]">✓</span>
          </div>
          <h1 className="mb-4 text-3xl font-black text-[#1c2b25]">
            お支払いが完了しました
          </h1>
          <p className="mb-8 leading-relaxed text-[#607069]">ありがとうございました。</p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-[#0b806b] px-8 py-3 font-semibold text-white transition-colors hover:bg-[#0a6f5d]"
          >
            トップページへ
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
