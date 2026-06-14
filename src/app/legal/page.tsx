import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | E-FIX",
};

interface TableRowProps {
  label: string;
  value: React.ReactNode;
}

function TableRow({ label, value }: TableRowProps) {
  return (
    <tr className="border-t border-slate-700/50">
      <th
        scope="row"
        className="py-4 pr-6 text-sm font-semibold text-slate-300 align-top w-40 sm:w-52 shrink-0"
      >
        {label}
      </th>
      <td className="py-4 text-sm text-slate-400 leading-relaxed">{value}</td>
    </tr>
  );
}

export default function LegalPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-black text-white mb-10">
          特定商取引法に基づく表記
        </h1>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <tbody>
              <TableRow label="販売業者" value="IT（屋号）" />
              <TableRow label="運営責任者" value="石川卓磨" />
              <TableRow
                label="所在地"
                value="〒062-0041 北海道札幌市豊平区福住一条7丁目4-13"
              />
              <TableRow
                label="電話番号"
                value={
                  <a
                    href="tel:08062824834"
                    className="text-emerald-400 hover:underline"
                  >
                    080-6282-4834
                  </a>
                }
              />
              <TableRow
                label="メールアドレス"
                value={
                  <a
                    href="mailto:takuma.ishikawa.line@gmail.com"
                    className="text-emerald-400 hover:underline break-all"
                  >
                    takuma.ishikawa.line@gmail.com
                  </a>
                }
              />
              <TableRow
                label="適格請求書発行事業者登録番号"
                value="T2810703528253"
              />
              <TableRow
                label="販売価格"
                value={
                  <ul className="space-y-2">
                    <li>
                      e-steer 20: ¥1,045,455（税別） /
                      <span className="font-bold text-white">
                        {" "}¥1,150,000（税込・取付サービス込み）
                      </span>
                    </li>
                    <li>
                      e-steer 20 MAX: ¥1,181,819（税別） /
                      <span className="font-bold text-white">
                        {" "}¥1,300,000（税込・取付サービス込み）
                      </span>
                    </li>
                    <li className="mt-3 text-xs text-slate-500">
                      ※ 取付サービスを利用しない場合は、e-steer 20 で
                      <span className="text-slate-300">{" "}-¥160,000</span>、
                      e-steer 20 MAX で
                      <span className="text-slate-300">{" "}-¥200,000</span>
                      の割引が適用されます（税込）。
                    </li>
                    <li className="text-xs text-slate-500">
                      ※ オプション商品の価格は商品ページに記載しております。
                    </li>
                  </ul>
                }
              />
              <TableRow
                label="販売対象エリア"
                value={
                  <p>
                    現在は<strong className="text-emerald-400">北海道のみ</strong>販売しております。本州・四国・九州への展開は順次拡大予定です。
                  </p>
                }
              />
              <TableRow
                label="消費税"
                value="表示価格は税込（消費税10%を含む）です。"
              />
              <TableRow
                label="支払方法"
                value="クレジットカード（Visa / Mastercard / JCB / American Express / Diners Club）／ 銀行振込（Stripe仮想口座）"
              />
              <TableRow
                label="支払時期"
                value="ご注文時にお支払いいただきます。銀行振込の場合はご注文後7日以内にご入金ください。"
              />
              <TableRow
                label="商品の引渡し時期"
                value={
                  <p>
                    在庫保有のため、原則1〜3営業日以内に発送いたします。
                    取付サービスをご利用の場合は、発送後5〜10営業日を目安に取付完了となります（外注スケジュールにより前後する場合があります）。
                    在庫切れの場合は入荷後速やかに発送いたします。
                  </p>
                }
              />
              <TableRow
                label="商品代金以外の必要料金"
                value={
                  <ul className="space-y-1">
                    <li>取付サービス料: 本体販売価格に含まれます</li>
                    <li>オプションのみご購入の場合の送料</li>
                    <li>振込手数料（顧客負担）</li>
                    <li>保証期間外の返送送料（顧客負担）</li>
                  </ul>
                }
              />
              <TableRow
                label="保証期間"
                value={
                  <ul className="space-y-1 text-xs">
                    <li>ディスプレイ・アンテナ・モーター: 1年</li>
                    <li>ケーブル類・その他部品: 半年</li>
                    <li>取付起因不具合: 取付完了から1ヶ月</li>
                    <li className="mt-2 text-slate-500">
                      ※ 保証起算日は取付完了日（取付サービス利用時）または発送日（取付なしの場合）
                    </li>
                  </ul>
                }
              />
              <TableRow
                label="返品・キャンセルについて"
                value={
                  <p>
                    商品の性質上、注文確定後のキャンセル・返品は原則お受けできません。
                    商品に瑕疵がある場合や保証期間内の不具合の場合は、商品同梱の「返送・修理依頼書」または当社へ電話・メールにてご連絡ください。
                    状況を確認のうえ、修理・交換・返金にて対応いたします。
                    保証期間内の返送送料は当社負担、保証期間外は顧客負担となります。
                  </p>
                }
              />
              <TableRow
                label="お問い合わせ"
                value={
                  <span>
                    電話:{" "}
                    <a
                      href="tel:08062824834"
                      className="text-emerald-400 hover:underline"
                    >
                      080-6282-4834
                    </a>
                    　／　メール:{" "}
                    <a
                      href="mailto:takuma.ishikawa.line@gmail.com"
                      className="text-emerald-400 hover:underline break-all"
                    >
                      takuma.ishikawa.line@gmail.com
                    </a>
                  </span>
                }
              />
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
