import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "プライバシーポリシー | E-FIX",
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 border-l-4 border-emerald-500 pl-3">
        {title}
      </h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-black text-white mb-4">
          プライバシーポリシー
        </h1>
        <p className="text-xs text-slate-500 mb-10">
          最終更新日: 2026年5月4日
        </p>

        <p className="text-sm text-slate-400 leading-relaxed mb-10">
          IT（屋号、運営責任者: 石川卓磨。以下「当社」といいます）は、
          E-FIX e-steer 販売サイト（以下「本サイト」といいます）の運営にあたり、
          お客さまの個人情報の保護を最も重要なものとして取り扱います。
          本ポリシーは、当社が取得する個人情報の取扱いについて定めるものです。
        </p>

        <Section title="1. 収集する個人情報">
          <p>当社は、本サイトの運営にあたり、以下の個人情報を取得することがあります。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>氏名、フリガナ</li>
            <li>メールアドレス、電話番号</li>
            <li>配送先住所、郵便番号</li>
            <li>農機メーカー名、機種名（取付対応の確認のため）</li>
            <li>注文内容、購入履歴</li>
            <li>適格請求書の発行に必要な情報</li>
          </ul>
          <p className="mt-3">
            なお、クレジットカード番号・セキュリティコード等の決済情報は、
            決済代行会社（PAY株式会社）が直接取得・保管し、当社は一切保持しません。
          </p>
        </Section>

        <Section title="2. 個人情報の利用目的">
          <p>取得した個人情報は、以下の目的の範囲内で利用します。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>商品の販売・配送・取付サービスの提供</li>
            <li>注文内容の確認・入金確認・発送通知等のご連絡</li>
            <li>適格請求書（インボイス）の発行・送付</li>
            <li>アフターサポート・お問い合わせへの対応</li>
            <li>商品の品質改善・新製品の開発</li>
            <li>不正取引の防止</li>
            <li>法令に基づく対応</li>
          </ul>
        </Section>

        <Section title="3. 第三者への提供">
          <p>当社は、以下の場合を除き、お客さまの個人情報を第三者に提供しません。</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>お客さまの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命・身体・財産の保護のために必要な場合</li>
            <li>業務委託先に対し、利用目的の達成に必要な範囲で提供する場合</li>
          </ul>
          <p className="mt-3">
            業務委託先として、以下の事業者に必要最小限の個人情報を提供します。
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>クレジットカード決済処理: PAY株式会社（PAY.JP）</li>
            <li>銀行振込・入金照合: GMOあおぞらネット銀行株式会社</li>
            <li>会計処理・適格請求書発行: freee株式会社</li>
            <li>配送業務: 各配送会社</li>
            <li>サイト運営基盤: Vercel Inc.</li>
          </ul>
        </Section>

        <Section title="4. 個人情報の管理">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>個人情報は適切に管理し、紛失・破壊・改ざん・漏洩等の防止に必要な措置を講じます。</li>
            <li>本サイトとの通信は SSL/TLS により暗号化します。</li>
            <li>当社が保管する個人情報は、必要な場合に暗号化して保存します。</li>
            <li>業務上不要となった個人情報は、速やかに削除または匿名化します。</li>
          </ul>
        </Section>

        <Section title="5. クッキー（Cookie）の利用">
          <p>
            本サイトでは、サイトの利便性向上、利用状況の分析、不正利用の防止等を目的に、
            クッキーを利用することがあります。クッキーには個人を特定する情報は含まれません。
            ブラウザの設定により、クッキーの受け取りを拒否することができますが、
            その場合、本サイトの一部機能が正常に動作しなくなる可能性があります。
          </p>
        </Section>

        <Section title="6. 個人情報の開示・訂正・削除">
          <p>
            お客さまから自己の個人情報について、開示・訂正・削除・利用停止等のご請求があった場合は、
            ご本人であることを確認のうえ、速やかに対応いたします。
            ご請求は本ポリシー末尾のお問い合わせ窓口までご連絡ください。
          </p>
        </Section>

        <Section title="7. プライバシーポリシーの変更">
          <p>
            当社は、法令の改正・サービス内容の変更等に応じて、
            本ポリシーを変更することがあります。
            変更後のポリシーは、本サイトに掲載した時点で効力を生じます。
          </p>
        </Section>

        <Section title="8. お問い合わせ窓口">
          <p>本ポリシーに関するお問い合わせは、以下までご連絡ください。</p>
          <ul className="list-none space-y-1">
            <li>事業者名: IT（屋号）</li>
            <li>運営責任者: 石川卓磨</li>
            <li>所在地: 〒062-0041 北海道札幌市豊平区福住一条7丁目4-13</li>
            <li>
              電話:{" "}
              <a
                href="tel:08062824834"
                className="text-emerald-400 hover:underline"
              >
                080-6282-4834
              </a>
            </li>
            <li>
              メール:{" "}
              <a
                href="mailto:takuma.ishikawa.line@gmail.com"
                className="text-emerald-400 hover:underline break-all"
              >
                takuma.ishikawa.line@gmail.com
              </a>
            </li>
            <li>適格請求書発行事業者登録番号: T2810703528253</li>
          </ul>
        </Section>
      </main>
      <Footer />
    </>
  );
}
