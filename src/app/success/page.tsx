"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface SessionStatus {
  payment_status: string;
  amount_total: number | null;
  customer_email: string;
  session_id?: string;
  serial_number?: string | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<SessionStatus | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/session-status?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data: SessionStatus) => setStatus(data))
      .catch(() => {});
  }, [sessionId]);

  const isBankTransfer = status?.payment_status === "unpaid";

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-lg">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-8 border ${
              isBankTransfer
                ? "bg-amber-500/20 border-amber-500/40"
                : "bg-emerald-500/20 border-emerald-500/40"
            }`}
            aria-hidden="true"
          >
            <span className="text-4xl">{isBankTransfer ? "🏦" : "✓"}</span>
          </div>

          <h1 className="text-3xl font-black text-white mb-4">
            {isBankTransfer
              ? "ご注文を受け付けました"
              : "ご注文ありがとうございます"}
          </h1>

          {isBankTransfer ? (
            <div className="text-left space-y-4 mb-8">
              <p className="text-slate-300 leading-relaxed">
                銀行振込でのお支払いを選択いただきました。
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 text-sm text-amber-200">
                <p className="font-semibold mb-2">振込先口座について</p>
                <p>
                  振込先口座の情報は、ご登録のメールアドレス
                  {status?.customer_email && (
                    <span className="font-semibold">
                      （{status.customer_email}）
                    </span>
                  )}
                  宛にStripeからお送りしています。
                </p>
                <p className="mt-2">
                  メールに記載された口座へ、期限内にお振込みください。
                </p>
              </div>
              <p className="text-slate-400 text-sm">
                入金確認後、発送準備を開始いたします。
                確認メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
            </div>
          ) : (
            <p className="text-slate-400 leading-relaxed mb-8">
              決済が完了しました。ご登録のメールアドレス宛に確認メールをお送りします。
              <br />
              発送準備が整いましたら改めてご連絡いたします。
            </p>
          )}

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-sm mb-4 text-left">
            <p className="font-semibold text-slate-300 mb-1">注文番号</p>
            {status?.serial_number ? (
              <p className="text-2xl font-black text-emerald-400">
                {status.serial_number}
              </p>
            ) : (
              <p className="text-slate-400">
                発行処理中です。マイページの注文履歴でご確認いただけます。
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              お問い合わせ・注文キャンセルの際に必要になります。お控えください。
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 text-sm text-slate-400 mb-8 text-left">
            <p className="font-semibold text-slate-300 mb-2">お問い合わせ</p>
            <p>
              電話:{" "}
              <a
                href="tel:08062824834"
                className="text-emerald-400 hover:underline"
              >
                080-6282-4834
              </a>
            </p>
            <p>
              メール:{" "}
              <a
                href="mailto:takuma.ishikawa.line@gmail.com"
                className="text-emerald-400 hover:underline"
              >
                takuma.ishikawa.line@gmail.com
              </a>
            </p>
          </div>

          <div className="mb-3">
            <Link
              href={`/orders/cancel${
                sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""
              }`}
              className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
            >
              注文をキャンセルする
            </Link>
          </div>

          <Link
            href="/"
            className="inline-block bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-[#0a0f1e]"
          >
            トップページに戻る
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
