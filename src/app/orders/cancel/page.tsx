"use client";

import type { FormEvent } from "react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface CancelResult {
  ok?: boolean;
  message?: string;
  error?: string;
  refundId?: string;
}

function CancelOrderContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const [serialNumber, setSerialNumber] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CancelResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    const confirmed = window.confirm(
      [
        "この注文をキャンセルしますか？",
        "",
        "注文後1時間以内の場合、注文ステータスをキャンセル済みに更新します。",
        "カード決済済みの場合は返金処理も開始します。",
      ].join("\n"),
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          serialNumber,
          emailOrPhone,
        }),
      });
      const data = (await response.json()) as CancelResult;
      setResult(data);
    } catch (error) {
      setResult({
        error:
          error instanceof Error
            ? error.message
            : "キャンセル処理中に通信エラーが発生しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex-1 max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-emerald-400">ORDER CANCEL</p>
        <h1 className="mt-2 text-3xl font-black text-white">注文キャンセル</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          通常注文は注文後1時間以内に限り、この画面からキャンセルできます。
          注文番号が分かる場合は注文番号とメールまたは電話番号を入力してください。
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6"
        >
          {!sessionId && (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="serialNumber"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  注文番号
                </label>
                <input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  placeholder="例: 123"
                  className="h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="emailOrPhone"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  メールアドレスまたは電話番号
                </label>
                <input
                  id="emailOrPhone"
                  value={emailOrPhone}
                  onChange={(event) => setEmailOrPhone(event.target.value)}
                  placeholder="注文時の連絡先"
                  className="h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>
          )}

          {sessionId && (
            <div className="rounded-lg border border-emerald-700/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              この注文完了画面からキャンセルします。注文番号の入力は不要です。
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 h-12 w-full rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "処理中..." : "注文をキャンセルする"}
          </button>

          {result?.error && (
            <p className="mt-4 rounded-lg border border-red-700/40 bg-red-500/10 p-3 text-sm text-red-200">
              {result.error}
            </p>
          )}
          {result?.ok && (
            <p className="mt-4 rounded-lg border border-emerald-700/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {result.message ?? "キャンセルしました。"}
            </p>
          )}
        </form>
      </main>
      <Footer />
    </>
  );
}

export default function CancelOrderPage() {
  return (
    <Suspense>
      <CancelOrderContent />
    </Suspense>
  );
}
