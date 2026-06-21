"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const isLocalDev = process.env.NODE_ENV !== "production";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        setIsSubmitting(false);
        return;
      }
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      setIsSubmitting(false);
    }
  }

  async function handleDevLogin() {
    if (isSubmitting || isDevSubmitting) return;
    setIsDevSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/dev-login", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "開発ログインに失敗しました");
        setIsDevSubmitting(false);
        return;
      }
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラー");
      setIsDevSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-xl p-8 space-y-5"
      >
        <div className="text-center">
          <p className="text-2xl font-black tracking-widest text-emerald-400">
            E-FIX
          </p>
          <p className="text-xs text-slate-500 mt-1">管理者ログイン</p>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-slate-300 mb-1"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 rounded-lg p-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isDevSubmitting}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "認証中…" : "ログイン"}
        </button>

        {isLocalDev && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="h-px flex-1 bg-slate-800" />
              <span>localhost</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>
            <button
              type="button"
              onClick={handleDevLogin}
              disabled={isSubmitting || isDevSubmitting}
              className="w-full py-3 rounded-lg border border-emerald-700/50 bg-slate-950 text-emerald-300 font-bold hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isDevSubmitting ? "開発ログイン中..." : "開発ログイン"}
            </button>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center">
          12時間有効のセッションを発行します
        </p>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}
