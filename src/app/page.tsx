import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import StudyIndicator from "@/components/StudyIndicator";

export const dynamic = "force-dynamic";

function greeting(hour: number) {
  if (hour < 5) return "おつかれさまです";
  if (hour < 11) return "おはようございます";
  if (hour < 18) return "こんにちは";
  return "こんばんは";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let total = 0;
  let wordCount = 0;
  let idiomCount = 0;
  let due = 0;
  let totalReviews = 0;
  let recentDates: string[] = [];
  try {
    const nowIso = new Date().toISOString();
    // インジケータ用に直近8日間の last_reviewed を取得（日跨ぎ余白で 8 日）
    const eightDaysAgoIso = new Date(
      Date.now() - 8 * 86400000,
    ).toISOString();
    const [t, w, i, d, r, recent] = await Promise.all([
      supabase.from("words").select("*", { count: "exact", head: true }),
      supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .eq("kind", "word"),
      supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .eq("kind", "idiom"),
      supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .lte("srs_due", nowIso),
      supabase.from("words").select("total_reviews"),
      supabase
        .from("words")
        .select("last_reviewed")
        .gte("last_reviewed", eightDaysAgoIso),
    ]);
    total = t.count ?? 0;
    wordCount = w.count ?? 0;
    idiomCount = i.count ?? 0;
    due = d.count ?? 0;
    totalReviews = ((r.data as { total_reviews: number }[]) ?? []).reduce(
      (sum, row) => sum + (row.total_reviews ?? 0),
      0,
    );
    recentDates = (
      (recent.data as { last_reviewed: string | null }[]) ?? []
    )
      .map((row) => row.last_reviewed)
      .filter((s): s is string => !!s);
  } catch {
    // Supabase 未設定時はカウント 0 のまま表示する
  }

  const hour = new Date().getHours();

  return (
    <div className="flex animate-rise flex-col gap-5">
      <header>
        <p className="text-sm text-gray-500">{greeting(hour)}</p>
        <h1 className="text-2xl font-bold tracking-tight">単語ストック</h1>
        {user?.email && (
          <p className="mt-0.5 text-xs text-gray-400">{user.email}</p>
        )}
      </header>

      <Link
        href="/review"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white shadow-lg shadow-indigo-500/25 transition active:scale-[0.99]"
      >
        <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-100">今日の復習</p>
          <p className="mt-1 flex items-end gap-1.5">
            <span className="text-5xl font-bold tabular-nums leading-none">
              {due}
            </span>
            <span className="pb-1 text-base font-medium text-indigo-100">
              枚
            </span>
          </p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold backdrop-blur">
            {due > 0 ? "復習をはじめる" : "今日の復習は完了"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>

      <StudyIndicator isoDates={recentDates} dueCount={due} />

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
          <p className="text-xs text-gray-400">総数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{total}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
          <p className="flex items-center gap-1 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" />単語
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{wordCount}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
          <p className="flex items-center gap-1 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-violet-500" />イディオム
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{idiomCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
          <p className="text-xs text-gray-400">累計学習回数</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totalReviews}</p>
        </div>
        <Link
          href="/folders"
          className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm transition active:scale-[0.99]"
        >
          <span>
            <span className="block text-xs text-gray-400">学習の束</span>
            <span className="mt-1 block text-sm font-semibold">フォルダ管理</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-300">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
      </div>

      <Link
        href="/add"
        className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">単語を追加</span>
          <span className="text-xs text-gray-500">
            GPTが意味・発音・例文を自動生成
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-5 w-5 text-gray-300">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>

      <Link
        href="/words"
        className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
          </svg>
        </span>
        <span className="flex flex-col">
          <span className="font-semibold">単語一覧</span>
          <span className="text-xs text-gray-500">
            登録した単語を検索・編集
          </span>
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-5 w-5 text-gray-300">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </Link>

      <div className="mt-2">
        <LogoutButton />
      </div>
    </div>
  );
}
