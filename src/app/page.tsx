import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import OptionCard from "@/components/OptionCard";
import { MAIN_PRODUCTS, OPTION_PRODUCTS } from "@/lib/products";

interface Feature {
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    title: "多様なガイドライン",
    description:
      "AB / 自由曲線 / 90度 / 全域パス / 境界線。圃場形状に合わせて使い分けられます。",
  },
  {
    title: "自動旋回機能",
    description:
      "ABライン・カーブ・境界・枕地、いずれもUターン自動化。マーカー立てやハンドル操作が不要に。",
  },
  {
    title: "高精度 ±2.5cm",
    description:
      "RTK / PointSky / VRS 全方式対応。通常5分以内に収束、移動中でも収束可能。",
  },
  {
    title: "全国170箇所以上の独自基地局",
    description:
      "EFIX独自の補正サービスインフラを順次増設中。山間地域でも安定した自動操舵を実現。",
  },
  {
    title: "超低速〜高速対応",
    description:
      "0.1〜32 km/h。畔塗り・トレンチャー等の低速作業から散布・整地の高速作業まで幅広く対応。",
  },
  {
    title: "ISOBUS対応",
    description:
      "UT/VT・TC-SC・TC-GEO・AUX-N に対応。メーカーを問わない機器連携で効率化。",
  },
  {
    title: "載せ替え可能",
    description:
      "1台で複数の農機にローテーション運用可能。専用ブラケット・スリーブで簡単載せ替え。",
  },
  {
    title: "簡素化キャリブレーション",
    description: "車両寸法入力 → 30m走行 → ロール調整 の 3工程で完了。",
  },
];

interface SpecRow {
  label: string;
  e20: string;
  e20max: string;
}

const COMPARE_ROWS: SpecRow[] = [
  { label: "画面サイズ", e20: "10.1 インチ", e20max: "12.1 インチ" },
  { label: "解像度", e20: "1280 × 800", e20max: "1280 × 800" },
  { label: "明るさ", e20: "750 nits", e20max: "750 nits" },
  { label: "GNSS", e20: "GPS / BDS / GLONASS / Galileo / QZSS + L-Band", e20max: "同左" },
  { label: "精度(RTK)", e20: "水平 ±8mm + 1ppm RMS", e20max: "同左" },
  { label: "定格トルク", e20: "7 N·m", e20max: "7 N·m" },
  { label: "ステアリング径", e20: "360mm / 400mm", e20max: "360mm / 400mm" },
  { label: "防塵・防水", e20: "IP67 (タブレット・受信機・カメラ) / IP65 (モータ)", e20max: "同左" },
  { label: "動作温度", e20: "-20℃ 〜 +70℃", e20max: "同左" },
  { label: "OS", e20: "Android 11", e20max: "Android 11" },
  { label: "ISOBUS", e20: "UT/VT / TC-SC / TC-GEO / AUX-N", e20max: "同左" },
  {
    label: "おすすめ用途",
    e20: "国産トラクター・コンバインのキャビン",
    e20max: "外車トラクター / 視認性重視 / 老眼対応",
  },
];

interface CorrectionService {
  name: string;
  method: string;
  price: string;
  feature: string;
}

const CORRECTION_SERVICES: CorrectionService[] = [
  {
    name: "PointSky (EFIX独自)",
    method: "PPP-AR / 衛星から直接受信",
    price: "年 ¥39,600（税込）／ 初年度1年間無料",
    feature: "ネットワーク不要、山間地域でも使用可能",
  },
  {
    name: "VRS",
    method: "SIM Card / テザリング",
    price: "永久無料 ／ SIM Card 半年間無料",
    feature: "RTKフィックスが早い、安定した精度",
  },
];

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
              E-FIXの電動ステアリングシステム{" "}
              <strong className="text-white">e-steer 20 / e-steer 20 MAX</strong>{" "}
              は、農業機械に直接装着して GPS連動の高精度自動操舵を実現。 精度 ±2.5cm の直進アシストで作業負担を大幅に軽減します。
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">
                  ●
                </span>
                精度 ±2.5cm
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">
                  ●
                </span>
                全農機メーカー対応
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">
                  ●
                </span>
                載せ替え可能
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400" aria-hidden="true">
                  ●
                </span>
                ISOBUS 対応
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

        {/* Metrics */}
        <section className="py-16 bg-slate-900/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">
                  ±2.5cm
                </p>
                <p className="text-xs text-slate-400 mt-2">自動操舵 精度</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">
                  170+
                </p>
                <p className="text-xs text-slate-400 mt-2">独自基地局 全国</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">
                  全機種
                </p>
                <p className="text-xs text-slate-400 mt-2">対応農機メーカー</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400">
                  0.1〜32
                </p>
                <p className="text-xs text-slate-400 mt-2">km/h 対応速度</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-labelledby="features-heading"
        >
          <header className="mb-12 text-center">
            <h2 id="features-heading" className="text-3xl font-black text-white">
              主な機能
            </h2>
            <p className="mt-3 text-slate-400">
              e-steer シリーズ標準搭載の自動操舵機能
            </p>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-emerald-700/40 transition-colors"
              >
                <h3 className="text-white font-bold mb-2">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Products */}
        <section
          id="products"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-labelledby="products-heading"
        >
          <header className="mb-12 text-center">
            <h2 id="products-heading" className="text-3xl font-black text-white">
              製品ラインナップ
            </h2>
            <p className="mt-3 text-slate-400">
              キャビンサイズと視認性で選べる2モデル（性能スペックは同等）
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {MAIN_PRODUCTS.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                featured={index === MAIN_PRODUCTS.length - 1}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            ※ 価格は全て税込表記です。
          </p>
        </section>

        {/* Comparison */}
        <section
          id="compare"
          className="py-20 bg-slate-900/40"
          aria-labelledby="compare-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="mb-10 text-center">
              <h2
                id="compare-heading"
                className="text-3xl font-black text-white"
              >
                20 と 20 MAX のちがい
              </h2>
              <p className="mt-3 text-slate-400">
                差はディスプレイサイズのみ。それ以外のスペックは完全同等。
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold w-1/4">
                      項目
                    </th>
                    <th className="text-left py-3 px-4 text-white font-semibold">
                      e-steer 20
                    </th>
                    <th className="text-left py-3 px-4 text-amber-300 font-semibold">
                      e-steer 20 MAX
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-slate-800/60 hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4 text-slate-400">{row.label}</td>
                      <td className="py-3 px-4 text-slate-200">{row.e20}</td>
                      <td className="py-3 px-4 text-slate-200">{row.e20max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Options */}
        <section
          id="options"
          className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          aria-labelledby="options-heading"
        >
          <header className="mb-8">
            <h2 id="options-heading" className="text-2xl font-black text-white">
              オプション
            </h2>
            <p className="mt-2 text-slate-400 text-sm">
              操作性を向上させるアクセサリーを追加できます
            </p>
          </header>
          <div className="space-y-4">
            {OPTION_PRODUCTS.map((product) => (
              <OptionCard key={product.id} product={product} />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            ※ 価格は全て税込表記です。
          </p>
        </section>

        {/* Correction Service */}
        <section
          id="correction"
          className="py-20 bg-slate-900/40"
          aria-labelledby="correction-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="mb-10 text-center">
              <h2
                id="correction-heading"
                className="text-3xl font-black text-white"
              >
                EFIX 位置補正サービス
              </h2>
              <p className="mt-3 text-slate-400">
                ±2.5cm 精度の自動操舵には補正サービスが必要です。2方式から選択可能。
              </p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {CORRECTION_SERVICES.map((s) => (
                <article
                  key={s.name}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-6"
                >
                  <h3 className="text-emerald-400 font-black text-lg">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{s.method}</p>
                  <p className="mt-4 text-white font-semibold">{s.price}</p>
                  <p className="mt-3 text-sm text-slate-300">{s.feature}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs text-slate-500 text-center">
              ※ PointSky は EFIX独自の測位サービスです。 ※ 収束時間・精度は地域によって異なる場合があります。
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-slate-300 text-lg mb-2">
              ご注文・お見積もり・装着のご相談
            </p>
            <p className="text-slate-500 text-sm mb-6">
              コールセンター 03-6260-1670 / または注文フォームからお気軽に
            </p>
            <Link
              href="/order"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-12 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              注文フォームへ進む
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
