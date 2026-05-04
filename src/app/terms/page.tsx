import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "利用規約 | E-FIX",
};

interface ArticleProps {
  number: string;
  title: string;
  children: React.ReactNode;
}

function Article({ number, title, children }: ArticleProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 border-l-4 border-emerald-500 pl-3">
        第{number}条（{title}）
      </h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-black text-white mb-4">利用規約</h1>
        <p className="text-xs text-slate-500 mb-10">
          最終更新日: 2026年5月4日
        </p>

        <p className="text-sm text-slate-400 leading-relaxed mb-10">
          本利用規約（以下「本規約」といいます）は、IT（屋号、運営責任者: 石川卓磨。以下「当社」といいます）が運営する
          E-FIX e-steer 販売サイト（以下「本サイト」といいます）の利用条件を定めるものです。
          本サイトをご利用になるお客さま（以下「ユーザー」といいます）は、本規約に同意したものとみなします。
        </p>

        <Article number="1" title="サービス内容">
          <p>
            当社は本サイトを通じて、農機具用電動ステアリングシステム「e-steer」シリーズ
            および関連オプション・部品の販売、ならびに取付サービスの提供を行います。
          </p>
        </Article>

        <Article number="2" title="売買契約の成立">
          <p>
            ユーザーが本サイトの注文フォームから注文を行い、決済が完了した時点で、
            当社とユーザーとの間に売買契約が成立するものとします。
            銀行振込によるご注文の場合は、当社が入金を確認した時点をもって契約成立とします。
          </p>
        </Article>

        <Article number="3" title="商品の引渡し">
          <p>
            商品の引渡しは、原則として在庫がある場合は入金確認後1〜3営業日以内に発送します。
            在庫がない場合は、入荷後に速やかに発送します（目安として2〜4週間）。
            天候・配送会社の事情等により遅延が生じる場合があります。
          </p>
        </Article>

        <Article number="4" title="支払方法">
          <p>支払方法は以下のとおりとします。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>クレジットカード決済（Visa / Mastercard / JCB / AMEX / Diners / Discover + Apple Pay）</li>
            <li>銀行振込（注文ごとに発行される専用口座への振込）</li>
          </ul>
          <p className="mt-3">
            銀行振込の振込手数料はユーザーの負担とします。
          </p>
        </Article>

        <Article number="5" title="返品・キャンセル">
          <p>
            商品発送前のキャンセルは、本サイトの「ご注文の確認・キャンセル」ページから申請できます。
            管理者が確認後、決済代行会社経由で返金します。
          </p>
          <p>
            商品発送後の返品・キャンセルは、原則としてお受けできません。
            ただし、商品到着後7日以内に初期不良が確認された場合に限り、
            交換または返金にて対応いたします。
          </p>
        </Article>

        <Article number="6" title="保証">
          <p>当社は、e-steer 製品について以下の保証を提供します（保証期間は納品日から起算）。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>ディスプレイ・アンテナ・モーター: 1年</li>
            <li>その他の部品（ハーネス、ブラケット、ボタン類等）: 半年</li>
          </ul>
          <p className="mt-3">
            保証は通常使用における故障・不具合が対象となり、取付不備・改造・水没・落下・経年劣化・消耗品は対象外です。
          </p>
        </Article>

        <Article number="7" title="禁止事項">
          <p>ユーザーは、本サイトの利用にあたり、以下の行為を行ってはなりません。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>法令・公序良俗に違反する行為</li>
            <li>虚偽の情報による注文・登録</li>
            <li>第三者になりすまして本サイトを利用する行為</li>
            <li>本サイトのシステムに不正アクセスする行為、または妨害する行為</li>
            <li>当社・他のユーザー・第三者の権利を侵害する行為</li>
            <li>商品を転売・再販する行為（事前承諾のある卸取引を除く）</li>
          </ul>
        </Article>

        <Article number="8" title="免責事項">
          <p>
            当社は、商品の取付作業に起因する損害、ならびに e-steer を利用した農作業中の事故・損害について、
            一切の責任を負いません。お客さまの自己責任において、適切な点検と安全確認のうえご使用ください。
          </p>
          <p>
            本サイトの不具合・通信障害・メンテナンス等によりユーザーに生じた損害について、
            当社の故意または重過失による場合を除き、当社は責任を負いません。
          </p>
        </Article>

        <Article number="9" title="知的財産権">
          <p>
            本サイトに掲載されている文章、画像、ロゴ、製品仕様等の著作権・商標権等の知的財産権は、
            当社または正当な権利者に帰属します。
            無断での複製・転載・改変・商用利用を禁じます。
          </p>
        </Article>

        <Article number="10" title="個人情報の取扱い">
          <p>
            当社は、ユーザーから取得した個人情報を、別途定める
            「
            <a href="/privacy" className="text-emerald-400 hover:underline">
              プライバシーポリシー
            </a>
            」
            に従って適切に取り扱います。
          </p>
        </Article>

        <Article number="11" title="規約の変更">
          <p>
            当社は、必要に応じて本規約を変更することがあります。
            変更後の規約は、本サイトに掲載した時点から効力を生じます。
            重要な変更については、ユーザーへ事前に通知するよう努めます。
          </p>
        </Article>

        <Article number="12" title="準拠法・管轄裁判所">
          <p>
            本規約は日本法に準拠して解釈されるものとします。
            本サイトの利用に関して生じた紛争については、
            札幌地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </Article>

        <div className="mt-12 pt-8 border-t border-slate-700/50 text-sm text-slate-500">
          <p>
            お問い合わせ:{" "}
            <a
              href="tel:08062824834"
              className="text-emerald-400 hover:underline"
            >
              080-6282-4834
            </a>{" "}
            ／{" "}
            <a
              href="mailto:takuma.ishikawa.line@gmail.com"
              className="text-emerald-400 hover:underline break-all"
            >
              takuma.ishikawa.line@gmail.com
            </a>
          </p>
          <p className="mt-2">
            事業者名: IT（屋号） ／ 運営責任者: 石川卓磨 ／
            適格請求書発行事業者登録番号: T2810703528253
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
