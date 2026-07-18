import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DueTodayCard from "@/components/DueTodayCard";
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
  let dueNew = 0;
  let totalReviews = 0;
  let recentDates: string[] = [];
  let upcomingDue: string[] = [];
  let newLogTimes: string[] = [];
  let retention: number | null = null;
  try {
    const nowIso = new Date().toISOString();
    // インジケータ用に直近8日間の復習ログを取得（日跨ぎ余白で 8 日）
    const eightDaysAgoIso = new Date(
      Date.now() - 8 * 86400000,
    ).toISOString();
    const sevenDaysAheadIso = new Date(
      Date.now() + 7 * 86400000,
    ).toISOString();
    const [t, w, i, d, dn, r, logs, fallback, upcoming, newLogs] = await Promise.all([
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
      // 期日到来のうち未学習（新規）。1日上限の計算に使う
      supabase
        .from("words")
        .select("*", { count: "exact", head: true })
        .lte("srs_due", nowIso)
        .eq("total_reviews", 0),
      supabase.from("words").select("total_reviews"),
      // 1 採点 = 1 行の正確な履歴（ヒートマップ・定着率用）
      supabase
        .from("review_logs")
        .select("reviewed_at, grade")
        .gte("reviewed_at", eightDaysAgoIso),
      // review_logs 導入前のデータ用フォールバック（単語ごとの最終復習日）
      supabase
        .from("words")
        .select("last_reviewed")
        .gte("last_reviewed", eightDaysAgoIso),
      // 忘却曲線スケジュールの見通し（今後7日に期日が来る単語）
      supabase
        .from("words")
        .select("srs_due")
        .gt("srs_due", nowIso)
        .lte("srs_due", sevenDaysAheadIso),
      // 直近の新規導入ログ（「今日始めた新規」の枚数はクライアント側でローカル日付判定）
      supabase
        .from("review_logs")
        .select("reviewed_at")
        .eq("was_new", true)
        .gte("reviewed_at", new Date(Date.now() - 48 * 3600000).toISOString()),
    ]);
    total = t.count ?? 0;
    wordCount = w.count ?? 0;
    idiomCount = i.count ?? 0;
    due = d.count ?? 0;
    dueNew = dn.count ?? 0;
    totalReviews = ((r.data as { total_reviews: number }[]) ?? []).reduce(
      (sum, row) => sum + (row.total_reviews ?? 0),
      0,
    );
    const logRows = logs.error
      ? []
      : ((logs.data as { reviewed_at: string; grade: string }[]) ?? []);
    if (logRows.length > 0) {
      recentDates = logRows.map((row) => row.reviewed_at);
      const correct = logRows.filter((row) => row.grade !== "again").length;
      retention = Math.round((correct / logRows.length) * 100);
    } else {
      recentDates = (
        (fallback.data as { last_reviewed: string | null }[]) ?? []
      )
        .map((row) => row.last_reviewed)
        .filter((s): s is string => !!s);
    }
    upcomingDue = ((upcoming.data as { srs_due: string }[]) ?? []).map(
      (row) => row.srs_due,
    );
    newLogTimes = newLogs.error
      ? []
      : (((newLogs.data as { reviewed_at: string }[]) ?? []).map(
          (row) => row.reviewed_at,
        ));
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

      <DueTodayCard
        dueNew={dueNew}
        dueOther={Math.max(0, due - dueNew)}
        newLogTimes={newLogTimes}
      />

      <StudyIndicator
        isoDates={recentDates}
        dueNew={dueNew}
        dueOther={Math.max(0, due - dueNew)}
        newLogTimes={newLogTimes}
        upcomingDue={upcomingDue}
        retention={retention}
      />

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
            単語・意味・例文を登録
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
