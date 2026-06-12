import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import { COVERAGE_MAP_EMBED_URL, COVERAGE_MAP_URL } from "@/lib/coverage";
import { MAIN_PRODUCTS, calcTaxIncluded, formatPrice } from "@/lib/products";

const sellingPoints = [
  ["直進精度", "±2.5cm"],
  ["衛星受信", "RTK / VRS"],
  ["圃場管理", "まっすぐ整う"],
];

const flow = [
  {
    title: "衛星から位置を受ける",
    body: "GNSSと補正情報で、車両の位置を高精度に把握します。",
  },
  {
    title: "走行ラインを作る",
    body: "畑の形に合わせてABラインや作業ラインを設定できます。",
  },
  {
    title: "まっすぐ走る",
    body: "ハンドル操作を支援し、重複や蛇行を減らします。",
  },
];

const officialVideos = [
  {
    title: "eSteer20取り付け完全ガイド",
    src: "/home-assets/videos/esteer20-install-guide.mp4",
    poster: "/home-assets/youtube/esteer20-install-guide.jpg",
    duration: "10:57",
  },
  {
    title: "eSteer20シリーズ - 完全防水でどんな天候でも安心！",
    src: "/home-assets/videos/esteer20-waterproof.mp4?v=mean-volume-match#t=10",
    poster: "/home-assets/youtube/esteer20-waterproof.jpg",
    duration: "4:50",
  },
];

export default function HomePage() {
  const eSteer20 = MAIN_PRODUCTS.find((product) => product.id === "e-steer-20");
  const eSteer20Max = MAIN_PRODUCTS.find(
    (product) => product.id === "e-steer-20-max",
  );

  return (
    <>
      <main className="min-h-screen bg-[#fbf7ef] text-[#24352f]">
        <section className="relative min-h-[84vh] overflow-hidden">
          <Image
            src="/home-assets/geo-diorama-hero.png"
            alt="衛星測位で整う畑のジオラマ"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,247,239,0.96)_0%,rgba(251,247,239,0.82)_34%,rgba(251,247,239,0.24)_68%,rgba(251,247,239,0.08)_100%)]"
            aria-hidden="true"
          />

          <header className="relative z-10 px-4 pt-4 sm:px-6 lg:px-10">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-lg border border-white/70 bg-white/72 px-4 shadow-[0_18px_60px_rgba(123,92,30,0.12)] backdrop-blur-md sm:px-6">
              <Link
                href="/"
                className="text-2xl font-black tracking-[0.16em] text-[#0b5c50]"
              >
                E-FIX
              </Link>
              <nav className="hidden items-center gap-7 text-sm font-semibold text-[#394842] md:flex">
                <a href="#concept" className="hover:text-[#b58a36]">
                  仕組み
                </a>
                <a href="#products" className="hover:text-[#b58a36]">
                  製品
                </a>
                <a href="#official-video" className="hover:text-[#b58a36]">
                  公式動画
                </a>
                <a href="#coverage" className="hover:text-[#b58a36]">
                  基地局カバー
                </a>
                <Link href="/orders/cancel" className="hover:text-[#b58a36]">
                  注文キャンセル
                </Link>
                <Link href="/legal" className="hover:text-[#b58a36]">
                  表記
                </Link>
              </nav>
              <Link
                href="/order"
                className="rounded-lg bg-[#c49a45] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(196,154,69,0.28)] transition hover:bg-[#af8737] sm:px-5"
              >
                注文する
              </Link>
            </div>
          </header>

          <div className="relative z-10 mx-auto grid min-h-[calc(84vh-80px)] max-w-7xl content-center px-4 pb-20 pt-10 sm:px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="mb-5 text-sm font-bold tracking-[0.24em] text-[#b58a36]">
                SATELLITE GUIDED FARMING
              </p>
              <h1 className="text-[clamp(3rem,8vw,7rem)] font-black leading-[0.96] tracking-normal text-[#26322f]">
                E-FIX
                <span className="mt-3 block text-[clamp(2rem,5vw,4.6rem)] font-black text-[#c49a45]">
                  e-steer
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-2xl font-bold leading-9 text-[#3c4a44] sm:text-3xl">
                まっすぐを、もっとやさしく。
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/order"
                  className="rounded-lg bg-[#c49a45] px-7 py-4 text-base font-bold text-white shadow-[0_18px_45px_rgba(196,154,69,0.32)] transition hover:bg-[#af8737]"
                >
                  注文する
                </Link>
                <a
                  href="mailto:takuma.ishikawa.line@gmail.com"
                  className="rounded-lg border border-[#c49a45]/45 bg-white/70 px-7 py-4 text-base font-bold text-[#8a6427] backdrop-blur transition hover:bg-white"
                >
                  相談する
                </a>
              </div>
            </div>

            <div className="mt-14 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {sellingPoints.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/70 bg-white/62 p-4 shadow-[0_18px_50px_rgba(112,91,48,0.12)] backdrop-blur-md"
                >
                  <p className="text-sm font-bold text-[#44514a]">{label}</p>
                  <p className="mt-2 text-2xl font-black text-[#b58a36]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="concept"
          className="border-y border-[#e7dcc8] bg-white py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  HOW IT WORKS
                </p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-[#26322f] sm:text-5xl">
                  畑の線が整うと、
                  <br />
                  作業が静かに変わる。
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {flow.map((item, index) => (
                  <article
                    key={item.title}
                    className="rounded-lg border border-[#eadfce] bg-[#fbf7ef] p-5"
                  >
                    <p className="text-sm font-black text-[#c49a45]">
                      STEP {index + 1}
                    </p>
                    <h3 className="mt-4 text-lg font-black text-[#26322f]">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#657068]">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="products" className="bg-[#fbf7ef] py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="max-w-3xl">
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  PRODUCT
                </p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-[#26322f] sm:text-5xl">
                  e-steer 20で、まっすぐをもっと簡単に。
                </h2>
                <p className="mt-6 text-base leading-8 text-[#5f6c65]">
                  一般販売サイトでは、e-steer 20 と e-steer 20MAX の本体セットを中心に紹介します。
                  畑の美しい直線と、現場で使う実物の安心感を両方見せます。
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/order"
                    className="rounded-lg bg-[#26322f] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#3a4842]"
                  >
                    製品を注文する
                  </Link>
                </div>
            </div>

            <div
              id="lineup"
              className="mt-10 grid gap-4 md:grid-cols-2 lg:mt-14"
            >
              {[eSteer20, eSteer20Max].map((product) => {
                if (!product) return null;
                return (
                  <article
                    key={product.id}
                    className="rounded-lg border border-[#eadfce] bg-white p-6 shadow-[0_20px_70px_rgba(112,91,48,0.1)]"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        <p className="text-xs font-bold tracking-[0.2em] text-[#b58a36]">
                          E-FIX SYSTEM
                        </p>
                        <h3 className="mt-3 text-2xl font-black text-[#26322f]">
                          {product.name}
                        </h3>
                      </div>
                      <p className="shrink-0 text-right text-xl font-black text-[#b58a36]">
                        ¥{formatPrice(calcTaxIncluded(product.priceExTax))}
                        <span className="block text-xs font-bold text-[#88928d]">
                          税込
                        </span>
                      </p>
                    </div>
                    <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-[#fbf7ef]">
                      <Image
                        src={
                          product.id === "e-steer-20"
                            ? "/home-assets/products/esteer-set-angle-left.png"
                            : "/home-assets/products/esteer-set-20max.png"
                        }
                        alt={`${product.name} 本体セット`}
                        fill
                        sizes="(min-width: 768px) 44vw, 92vw"
                        className="object-contain"
                      />
                    </div>
                    <p className="mt-5 text-sm leading-7 text-[#5f6c65]">
                      {product.id === "e-steer-20"
                        ? "10.1インチディスプレイ搭載。国産トラクターのキャビンに収まりやすい標準モデル。"
                        : "12.1インチ大型ディスプレイ搭載。広いキャビンや視認性を重視する方に向いた大画面モデル。"}
                    </p>
                    <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#526059]">
                      <span className="rounded-md bg-[#f6eedf] px-2 py-2">
                        ±2.5cm
                      </span>
                      <span className="rounded-md bg-[#edf4e8] px-2 py-2">
                        ISOBUS
                      </span>
                      <span className="rounded-md bg-[#f7e8be] px-2 py-2">
                        RTK対応
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="official-video" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  OFFICIAL CHANNEL
                </p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-[#26322f] sm:text-5xl">
                  取り付けも、
                  <br />
                  公式動画で確認。
                </h2>
                <p className="mt-6 text-base leading-8 text-[#5f6c65]">
                  E-FIX JAPAN公式チャンネルでは、eSteer20の取り付けや各機能の使い方を動画で確認できます。
                  導入前のイメージ作りにも使える、実機ベースの素材です。
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {officialVideos.map((video) => (
                  <article
                    key={video.src}
                    className="rounded-lg border border-[#eadfce] bg-[#fbf7ef] p-4 shadow-[0_24px_70px_rgba(112,91,48,0.12)]"
                  >
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      poster={video.poster}
                      className="aspect-video w-full rounded-lg bg-[#26322f] object-cover"
                    >
                      <source src={video.src} type="video/mp4" />
                    </video>
                    <div className="mt-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold tracking-[0.2em] text-[#b58a36]">
                          OFFICIAL MOVIE
                        </p>
                        <h3 className="mt-2 text-base font-black leading-6 text-[#26322f] sm:text-lg">
                          {video.title}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-[#80612d]">
                        {video.duration}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="coverage"
          className="border-y border-[#e7dcc8] bg-[#f5efe4] py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  BASE STATION COVERAGE
                </p>
                <h2 className="mt-4 text-3xl font-black leading-tight text-[#26322f] sm:text-5xl">
                  基地局カバー範囲を
                  <br />
                  マップで確認。
                </h2>
                <p className="mt-6 max-w-3xl text-base leading-8 text-[#5f6c65]">
                  E-FIXは無料で使える位置情報サービスを提供できるよう、日本全国で170ヶ所以上の独自基地局を設置しています。
                  基地局は順次増設中です。
                </p>
                <div className="mt-8 overflow-hidden rounded-lg border border-[#d8c9aa] bg-white shadow-[0_24px_80px_rgba(112,91,48,0.14)]">
                  <iframe
                    src={COVERAGE_MAP_EMBED_URL}
                    title="E-FIX 基地局カバー範囲マップ"
                    className="h-[420px] w-full sm:h-[520px]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              </div>

              <aside className="rounded-lg border border-[#d8c9aa] bg-white p-6 shadow-[0_24px_80px_rgba(112,91,48,0.12)]">
                <p className="text-xs font-bold tracking-[0.2em] text-[#b58a36]">
                  QR CODE
                </p>
                <h3 className="mt-3 text-2xl font-black text-[#26322f]">
                  スマホでカバー範囲を開く
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#657068]">
                  QRコードを読み取ると、E-FIXサイト内のカバー範囲ページを開けます。
                </p>
                <div className="mt-6 flex justify-center rounded-lg border border-[#eadfce] bg-[#fbf7ef] p-4">
                  <Image
                    src="/efix-coverage-qr.png"
                    alt="E-FIX基地局カバー範囲ページのQRコード"
                    width={240}
                    height={240}
                    className="h-56 w-56"
                    unoptimized
                  />
                </div>
                <div className="mt-6 grid gap-3">
                  <Link
                    href="/coverage"
                    className="inline-flex items-center justify-center rounded-lg bg-[#26322f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#3a4842]"
                  >
                    カバー範囲ページへ
                  </Link>
                  <a
                    href={COVERAGE_MAP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-[#d8c9aa] bg-[#fbf7ef] px-5 py-3 text-sm font-bold text-[#80612d] transition hover:border-[#c49a45] hover:bg-white"
                  >
                    Googleマップで見る
                  </a>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid gap-8 rounded-lg border border-[#eadfce] bg-[#fbf7ef] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
                  START
                </p>
                <h2 className="mt-3 text-3xl font-black text-[#26322f]">
                  まずは注文ページへ。
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#657068]">
                  支払いはStripeに統一済みです。カード決済と銀行振込に対応し、
                  適格請求書はStripeから自動発行されます。
                </p>
              </div>
              <Link
                href="/order"
                className="inline-flex items-center justify-center rounded-lg bg-[#c49a45] px-8 py-4 text-base font-bold text-white shadow-[0_18px_45px_rgba(196,154,69,0.26)] transition hover:bg-[#af8737]"
              >
                注文する
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
