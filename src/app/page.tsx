import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import OptionCard from "@/components/OptionCard";
import { MAIN_PRODUCTS, OPTION_PRODUCTS } from "@/lib/products";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-[#0a0f1e] py-24 sm:py-32">
          <div
            className="absolute inset-0 opacity-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 39px, #10b981 39px, #10b981 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #10b981 39px, #10b981 40px)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-emerald-400 text-sm font-bold tracking-[0.3em] uppercase mb-4">
              Precision Agriculture Technology
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
              農機具の作業精度を
              <br className="hidden sm:block" />
              <span className="text-emerald-400">次のステージへ</span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              E-FIXの電動ステアリングシステム <strong className="text-white">e-steer</strong> シリーズは、
              農業機械に直接装着してGPS連動の自動操舵を実現。
              直進精度の向上と作業負担の軽減を同時に達成します。
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">●</span>
                RTK-GPS対応
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">●</span>
                全農機メーカー対応
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">●</span>
                簡単取付
              </div>
            </div>
            <div className="mt-10">
              <Link
                href="/order"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-10 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                注文する
              </Link>
            </div>
          </div>
        </section>

        {/* Products */}
        <section
          id="products"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-labelledby="products-heading"
        >
          <header className="mb-12 text-center">
            <h2
              id="products-heading"
              className="text-3xl font-black text-white"
            >
              製品ラインナップ
            </h2>
            <p className="mt-3 text-slate-400">
              用途と規模に合わせた3モデルをご用意しています
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MAIN_PRODUCTS.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                featured={index === MAIN_PRODUCTS.length - 1}
              />
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            ※ 価格は全て税別表記です。消費税（10%）が別途かかります。
          </p>
        </section>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <hr className="border-slate-700/50" />
        </div>

        {/* Options */}
        <section
          id="options"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-labelledby="options-heading"
        >
          <header className="mb-8">
            <h2
              id="options-heading"
              className="text-2xl font-black text-white"
            >
              オプション
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              取付作業や専用パーツを追加できます
            </p>
          </header>

          <div className="space-y-4">
            {OPTION_PRODUCTS.map((product) => (
              <OptionCard key={product.id} product={product} />
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            ※ 価格は全て税別表記です。消費税（10%）が別途かかります。
          </p>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-slate-400 mb-4">
              製品とオプションを選んで、かんたん注文
            </p>
            <Link
              href="/order"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-12 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              注文フォームへ進む
            </Link>
          </div>
        </section>

        {/* About */}
        <section className="py-16 bg-slate-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <p
                  className="text-4xl font-black text-emerald-400"
                  aria-label="精度プラスマイナス1センチメートル"
                >
                  ±1cm
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  MAX モデルの直進精度
                </p>
              </div>
              <div>
                <p className="text-4xl font-black text-emerald-400">全機種</p>
                <p className="text-sm text-slate-400 mt-2">
                  対応農機メーカー
                </p>
              </div>
              <div>
                <p className="text-4xl font-black text-emerald-400">現地</p>
                <p className="text-sm text-slate-400 mt-2">
                  出張取付サービス対応
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
