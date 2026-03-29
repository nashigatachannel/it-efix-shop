"use client";

import { useState } from "react";
import type { ProductId } from "@/lib/products";

interface BuyButtonProps {
  productId: ProductId;
  label?: string;
}

export default function BuyButton({
  productId,
  label = "購入する",
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "決済ページの取得に失敗しました");
      }

      const data = (await res.json()) as { url?: string };

      if (!data.url) {
        throw new Error("決済URLが取得できませんでした");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        disabled={loading}
        aria-busy={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-800"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span
              className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              aria-hidden="true"
            />
            処理中...
          </span>
        ) : (
          label
        )}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
