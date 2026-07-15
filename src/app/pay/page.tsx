"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SalesQuoteGenerator from "./SalesQuoteGenerator";
import InvoicePayView from "./InvoicePayView";

// /pay は二つの用途を共存させている:
//   - ?t=<トークン> あり: 顧客向けの請求書カード払いページ(InvoicePayView)
//   - ?t なし: 営業向けカスタム決済URL生成ツール(SalesQuoteGenerator、既存機能)
// URLを分けず同一パスに統一しているのは、既存の営業向けツールの共有URLを変えないため。
function PayPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  if (token) {
    return <InvoicePayView token={token} />;
  }

  return <SalesQuoteGenerator />;
}

export default function PayPage() {
  return (
    <Suspense>
      <PayPageContent />
    </Suspense>
  );
}
