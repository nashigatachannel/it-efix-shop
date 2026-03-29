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
                label="販売価格"
                value={
                  <ul className="space-y-1">
                    <li>e-steer 10: ¥820,000（税別）／ ¥902,000（税込）</li>
                    <li>e-steer 20: ¥900,000（税別）／ ¥990,000（税込）</li>
                    <li>
                      e-steer 20 MAX: ¥1,000,000（税別）／ ¥1,100,000（税込）
                    </li>
                    <li>取付料（オプション）: ¥100,000（税別）／ ¥110,000（税込）</li>
                    <li>取付ブラケット（オプション）: ¥100,000（税別）／ ¥110,000（税込）</li>
                    <li>スリーブ（オプション）: ¥8,000（税別）／ ¥8,800（税込）</li>
                  </ul>
                }
              />
              <TableRow
                label="消費税"
                value="表示価格は税別です。消費税10%を加算した金額でご購入いただきます。"
              />
              <TableRow
                label="支払方法"
                value="クレジットカード（Visa / Mastercard / JCB / American Express / Diners Club）"
              />
              <TableRow
                label="支払時期"
                value="ご注文時にお支払いいただきます。"
              />
              <TableRow
                label="商品の引渡し時期"
                value="ご入金確認後、別途ご連絡の上、出荷いたします。通常2〜4週間程度をめどに発送いたします。"
              />
              <TableRow
                label="返品・キャンセルについて"
                value={
                  <p>
                    商品の性質上、注文確定後のキャンセル・返品は原則お受けできません。
                    ただし、商品に瑕疵（欠陥）がある場合は、商品到着後7日以内にメールまたは電話にてご連絡ください。
                    状況を確認のうえ、交換または返金にて対応いたします。
                  </p>
                }
              />
              <TableRow
                label="送料"
                value="別途実費をご請求いたします。取付サービスをご利用の場合は出張費が含まれます。詳細はお問い合わせください。"
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
