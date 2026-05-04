"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/distributor";

  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/distributor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        setIsSubmitting(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900/80 border border-amber-700/40 rounded-xl p-8 space-y-5"
      >
        <div className="text-center">
          <p className="text-2xl font-black tracking-widest text-amber-400">
            E-FIX
          </p>
          <p className="text-sm text-slate-300 mt-1">特価卸 専用ページ</p>
          <p className="text-xs text-slate-500 mt-1">
            契約販売店様向けの最特価です
          </p>
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-300 mb-1"
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg p-3">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-40"
        >
          {isSubmitting ? "認証中…" : "ログイン"}
        </button>
        <p className="text-xs text-slate-600 text-center">
          24時間有効のセッションを発行します
        </p>
      </form>
    </main>
  );
}

export default function DistributorLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}
