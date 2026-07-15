"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface LookupResponse {
  invDisplay: string;
  customerName: string;
  amountJpy: number;
  alreadyPaid: boolean;
}

interface LiffProfile {
  userId: string;
  displayName: string;
}

interface LiffLike {
  init(config: { liffId: string }): Promise<void>;
  isLoggedIn(): boolean;
  getProfile(): Promise<LiffProfile>;
}

const DEFAULT_ERROR_MESSAGE =
  "このリンクは無効です。お手数ですがEFIX担当までご連絡ください";

let liffSdkPromise: Promise<void> | null = null;

// LIFF SDKはCDNスクリプトタグではなく公式配信元から動的ロードする(npm依存を増やさないため)。
function loadLiffSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }
  if ((window as unknown as { liff?: unknown }).liff) {
    return Promise.resolve();
  }
  if (liffSdkPromise) return liffSdkPromise;

  liffSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load LIFF SDK"));
    document.head.appendChild(script);
  });

  return liffSdkPromise;
}

export default function InvoicePayView({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>(DEFAULT_ERROR_MESSAGE);
  const [invoice, setInvoice] = useState<LookupResponse | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string>("");

  // 請求書情報の照会。INV番号の直接指定は受け付けないAPI側の設計に合わせ、必ずtoken経由で叩く。
  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      try {
        const res = await fetch("/api/pay/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as Partial<LookupResponse> & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.invDisplay) {
          setErrorMessage(data.error ?? DEFAULT_ERROR_MESSAGE);
          setStatus("invalid");
          return;
        }
        setInvoice({
          invDisplay: data.invDisplay,
          customerName: data.customerName ?? "",
          amountJpy: data.amountJpy ?? 0,
          alreadyPaid: data.alreadyPaid ?? false,
        });
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setErrorMessage(DEFAULT_ERROR_MESSAGE);
        setStatus("invalid");
      }
    }

    void lookup();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // LINE(LIFF)プロフィールの紐付け。envが無ければ完全にスキップし、失敗しても決済フローには影響させない。
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_PAY_LIFF_ID;
    if (!liffId) return;

    let cancelled = false;

    async function bindLine() {
      try {
        await loadLiffSdk();
        const liff = (window as unknown as { liff?: LiffLike }).liff;
        if (!liff) return;
        await liff.init({ liffId: liffId as string });
        if (!liff.isLoggedIn()) return;
        const profile = await liff.getProfile();
        if (cancelled) return;
        await fetch("/api/pay/line-binding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            userId: profile.userId,
            displayName: profile.displayName,
          }),
        });
      } catch (err) {
        console.error("LIFF binding failed:", err);
      }
    }

    void bindLine();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handlePay = useCallback(async () => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    setCheckoutError("");

    try {
      const res = await fetch("/api/pay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "決済ページの作成に失敗しました");
      }
      window.location.assign(data.url);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "エラーが発生しました");
      setIsRedirecting(false);
    }
  }, [token, isRedirecting]);

  return (
    <>
      <Header />
      <main className="mx-auto flex-1 w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-bold text-[#0b806b]">お支払い</p>
        <h1 className="mt-2 text-3xl font-black text-[#1c2b25]">
          請求書のお支払い
        </h1>

        {status === "loading" && (
          <p className="mt-8 text-sm text-[#607069]">読み込んでいます…</p>
        )}

        {status === "invalid" && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {status === "ready" && invoice && (
          <div className="mt-8 rounded-xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-lg font-black text-[#1c2b25]">
              {invoice.customerName} 様
            </p>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex items-baseline justify-between border-b border-[#eadfce] pb-3">
                <dt className="text-[#607069]">請求書番号</dt>
                <dd className="font-bold text-[#1c2b25]">{invoice.invDisplay}</dd>
              </div>
              <div className="flex items-baseline justify-between pb-1">
                <dt className="text-[#607069]">お支払い金額（税込）</dt>
                <dd className="text-2xl font-black text-[#0b806b]">
                  ¥{invoice.amountJpy.toLocaleString("ja-JP")}
                </dd>
              </div>
            </dl>

            {invoice.alreadyPaid ? (
              <div className="mt-8 rounded-lg border border-[#0b806b]/30 bg-[#eef7f3] p-4 text-sm font-bold text-[#0b806b]">
                この請求書はお支払い済みです
              </div>
            ) : (
              <>
                {checkoutError && (
                  <p className="mt-6 text-sm text-red-600">{checkoutError}</p>
                )}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isRedirecting}
                  className="mt-8 w-full rounded-xl bg-[#0b806b] py-4 text-lg font-black text-white transition hover:bg-[#0a6f5d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRedirecting ? "決済ページへ移動中…" : "クレジットカードでお支払い"}
                </button>
                <p className="mt-4 text-xs text-[#88928d]">
                  お支払いはStripeの安全な決済ページで行われます。
                </p>
              </>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
