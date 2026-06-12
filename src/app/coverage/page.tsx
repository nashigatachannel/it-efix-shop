import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import {
  COVERAGE_MAP_EMBED_URL,
  COVERAGE_MAP_URL,
  COVERAGE_PAGE_URL,
} from "@/lib/coverage";

export const metadata: Metadata = {
  title: "基地局カバー範囲 | E-FIX",
  description:
    "E-FIXの独自基地局カバー範囲をGoogleマップで確認できます。日本全国で170ヶ所以上の基地局を順次増設中です。",
  alternates: { canonical: "/coverage" },
  openGraph: {
    title: "基地局カバー範囲 | E-FIX",
    description:
      "E-FIXの独自基地局カバー範囲をGoogleマップで確認できます。",
    url: COVERAGE_PAGE_URL,
  },
};

export default function CoveragePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#fbf7ef] text-[#24352f]">
        <section className="border-b border-[#e7dcc8] bg-white py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  BASE STATION COVERAGE
                </p>
                <h1 className="mt-4 text-4xl font-black leading-tight text-[#26322f] sm:text-6xl">
                  E-FIX基地局
                  <br />
                  カバー範囲
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-8 text-[#5f6c65]">
                  E-FIXは無料で使える位置情報サービスを提供できるよう、日本全国で170ヶ所以上の独自基地局を設置しています。
                  下のマップで現在のカバー範囲を確認できます。
                </p>
              </div>

              <div className="rounded-lg border border-[#eadfce] bg-[#fbf7ef] p-5">
                <p className="text-xs font-bold tracking-[0.2em] text-[#b58a36]">
                  QR CODE
                </p>
                <div className="mt-4 flex justify-center rounded-lg border border-[#eadfce] bg-white p-4">
                  <Image
                    src="/efix-coverage-qr.png"
                    alt="E-FIX基地局カバー範囲ページのQRコード"
                    width={220}
                    height={220}
                    className="h-52 w-52"
                    priority
                    unoptimized
                  />
                </div>
                <p className="mt-4 text-sm leading-7 text-[#657068]">
                  印刷物に使う場合は、このページのQRコードをご利用ください。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="overflow-hidden rounded-lg border border-[#d8c9aa] bg-white shadow-[0_24px_90px_rgba(112,91,48,0.14)]">
              <iframe
                src={COVERAGE_MAP_EMBED_URL}
                title="E-FIX 基地局カバー範囲マップ"
                className="h-[70vh] min-h-[480px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={COVERAGE_MAP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-[#26322f] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3a4842]"
              >
                Googleマップで開く
              </a>
              <Link
                href="/order"
                className="inline-flex items-center justify-center rounded-lg border border-[#d8c9aa] bg-white px-6 py-3 text-sm font-bold text-[#80612d] transition hover:border-[#c49a45] hover:bg-[#fbf7ef]"
              >
                製品を注文する
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
