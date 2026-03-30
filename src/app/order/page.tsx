import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import OrderForm from "@/components/OrderForm";

export const metadata: Metadata = {
  title: "ご注文 | E-FIX",
};

export default function OrderPage() {
  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-black text-white mb-8">ご注文</h1>
        <OrderForm />
      </main>
      <Footer />
    </>
  );
}
