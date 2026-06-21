import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OrderForm from "@/components/OrderForm";
import { fetchWebOrderProductGroups } from "@/lib/web-catalog";

export const metadata: Metadata = {
  title: "ご注文 | E-FIX",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrderPage() {
  const productGroups = await fetchWebOrderProductGroups();

  return (
    <>
      <Header />
      <main className="flex-1 bg-[#fbf7ef] px-4 py-12 text-[#26322f] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold tracking-[0.22em] text-[#b58a36]">
            ORDER
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#26322f] sm:text-5xl">
            ご注文
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#607069]">
            製品画像を見ながら、本体と必要なオプションを選択できます。
            支払いはStripeで、カード決済と銀行振込に対応しています。
          </p>
          <div className="mt-10">
            <OrderForm {...productGroups} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
