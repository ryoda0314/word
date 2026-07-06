"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

const FIELD =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfo(
            "確認メールを送信しました。メール内のリンクを開いたあとログインしてください。",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  return (
    <div className="relative flex min-h-[82dvh] flex-col justify-center gap-7">
      <div className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-72 bg-gradient-to-b from-indigo-200/60 via-violet-100/40 to-transparent blur-2xl" />

      <header className="flex animate-rise flex-col items-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-extrabold text-white shadow-lg shadow-indigo-500/30">
          W
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Wordtock</h1>
        <p className="mt-1.5 text-sm text-gray-500">
          知らない英語・韓国語の単語をためて復習
        </p>
      </header>

      <div
        className="animate-rise rounded-2xl border border-black/5 bg-white p-5 shadow-sm"
        style={{ animationDelay: "0.07s" }}
      >
        <div className="mb-5 flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 rounded-lg py-2 transition ${
              mode === "signin"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 rounded-lg py-2 transition ${
              mode === "signup"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500"
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-600">
              メールアドレス
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={FIELD}
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-600">
              パスワード
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              className={FIELD}
              placeholder="6文字以上"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl bg-indigo-600 py-3.5 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {loading
              ? "処理中…"
              : mode === "signin"
                ? "ログイン"
                : "登録する"}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400">
        {mode === "signin"
          ? "アカウントがない場合は「新規登録」から"
          : "登録後、すぐに使いはじめられます"}
      </p>
    </div>
  );
}
