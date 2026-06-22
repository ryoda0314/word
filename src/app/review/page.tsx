"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyGrade, nextIntervalLabel, type Grade } from "@/lib/srs";
import {
  KIND_META,
  LANGUAGE_META,
  type Folder,
  type Kind,
  type Language,
  type Word,
} from "@/lib/types";

const GRADES: { grade: Grade; label: string; className: string }[] = [
  {
    grade: "again",
    label: "もう一度",
    className: "bg-red-50 text-red-600 border-red-200 active:bg-red-100",
  },
  {
    grade: "hard",
    label: "むずかしい",
    className: "bg-amber-50 text-amber-700 border-amber-200 active:bg-amber-100",
  },
  {
    grade: "good",
    label: "ふつう",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 active:bg-emerald-100",
  },
  {
    grade: "easy",
    label: "かんたん",
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 active:bg-indigo-100",
  },
];

type Phase = "setup" | "session" | "done";
type LangFilter = "all" | Language;
type KindFilter = "all" | Kind;
type FolderFilter = "all" | "none" | string;
type Scope = "due" | "all";
type Order = "due_asc" | "new_first" | "shuffle";
type SizeOption = 10 | 20 | 50 | 0; // 0 = すべて

const SIZE_OPTIONS: SizeOption[] = [10, 20, 50, 0];

function shuffleArr<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ReviewPageInner() {
  const params = useSearchParams();
  const initialFolder = (params.get("folder") as FolderFilter | null) ?? "all";

  const [phase, setPhase] = useState<Phase>("setup");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  // セット設定
  const [folderFilter, setFolderFilter] = useState<FolderFilter>(initialFolder);
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [scope, setScope] = useState<Scope>("due");
  const [order, setOrder] = useState<Order>("due_asc");
  const [size, setSize] = useState<SizeOption>(20);

  // 進行中セット
  const [queue, setQueue] = useState<Word[]>([]);
  const [sessionSize, setSessionSize] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("words").select("*"),
      supabase
        .from("folders")
        .select("*")
        .order("created_at", { ascending: false }),
    ]).then(([w, f]) => {
      setAllWords((w.data as Word[]) ?? []);
      setFolders((f.data as Folder[]) ?? []);
      setLoading(false);
    });
  }, []);

  // 設定にマッチする全候補
  const eligible = useMemo(() => {
    const now = new Date();
    return allWords.filter((w) => {
      const kind = w.kind ?? "word";
      if (folderFilter === "none" && w.folder_id) return false;
      if (
        folderFilter !== "all" &&
        folderFilter !== "none" &&
        w.folder_id !== folderFilter
      )
        return false;
      if (langFilter !== "all" && w.language !== langFilter) return false;
      if (kindFilter !== "all" && kind !== kindFilter) return false;
      if (scope === "due" && new Date(w.srs_due) > now) return false;
      return true;
    });
  }, [allWords, folderFilter, langFilter, kindFilter, scope]);

  // 開始ボタン押下時に最終的に並べるキュー
  function buildQueue(): Word[] {
    let arr = eligible.slice();
    if (order === "due_asc") {
      arr.sort((a, b) => a.srs_due.localeCompare(b.srs_due));
    } else if (order === "new_first") {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      arr = shuffleArr(arr);
    }
    if (size > 0) arr = arr.slice(0, size);
    return arr;
  }

  const previewCount = size === 0 ? eligible.length : Math.min(size, eligible.length);

  // セッション完了判定（キューが尽きたら done へ）
  useEffect(() => {
    if (phase === "session" && queue.length === 0 && reviewedCount > 0) {
      setPhase("done");
    }
  }, [phase, queue.length, reviewedCount]);

  function startSession() {
    const q = buildQueue();
    if (q.length === 0) return;
    setQueue(q);
    setSessionSize(q.length);
    setRevealed(false);
    setReviewedCount(0);
    setCorrectCount(0);
    setPhase("session");
  }

  function backToSetup() {
    setPhase("setup");
    setQueue([]);
    setRevealed(false);
  }

  const current = queue[0];

  async function handleGrade(grade: Grade) {
    if (!current) return;
    const update = applyGrade(current, grade);
    const isCorrect = grade !== "again";
    const supabase = createClient();
    const baseTotal = current.total_reviews ?? 0;
    const baseCorrect = current.correct_reviews ?? 0;
    await supabase
      .from("words")
      .update({
        ...update,
        total_reviews: baseTotal + 1,
        correct_reviews: baseCorrect + (isCorrect ? 1 : 0),
      })
      .eq("id", current.id);

    setReviewedCount((c) => c + 1);
    if (isCorrect) setCorrectCount((c) => c + 1);
    setRevealed(false);
    // also reflect new srs_due/total_reviews in allWords so eligible のカウントも整合
    setAllWords((ws) =>
      ws.map((w) =>
        w.id === current.id
          ? {
              ...w,
              ...update,
              total_reviews: baseTotal + 1,
              correct_reviews: baseCorrect + (isCorrect ? 1 : 0),
            }
          : w,
      ),
    );
    setQueue((q) => {
      const rest = q.slice(1);
      if (grade === "again") {
        return [
          ...rest,
          {
            ...current,
            ...update,
            total_reviews: baseTotal + 1,
            correct_reviews: baseCorrect,
          },
        ];
      }
      return rest;
    });
  }

  // ───────────────────────────────────────────────
  // ローディング
  // ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex animate-rise flex-col gap-4">
        <div className="h-6 w-32 rounded bg-gray-200" />
        <div className="h-40 w-full rounded-2xl bg-white shadow-sm" />
        <div className="h-40 w-full rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // 完了画面
  // ───────────────────────────────────────────────
  if (phase === "done") {
    const acc =
      reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;
    return (
      <div className="flex animate-rise flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold">セット完了</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sessionSize} 枚 ・ 正答率 {acc}%
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              backToSetup();
            }}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600"
          >
            セットを変える
          </button>
          <button
            type="button"
            onClick={startSession}
            disabled={eligible.length === 0}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 disabled:opacity-40"
          >
            同じ条件でもう一度
          </button>
          <Link
            href="/"
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600"
          >
            ホームへ
          </Link>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // セッション中
  // ───────────────────────────────────────────────
  if (phase === "session" && current) {
    const meta = LANGUAGE_META[current.language];
    const kindMeta = KIND_META[current.kind ?? "word"];
    const totalReviews = current.total_reviews ?? 0;
    const correctReviews = current.correct_reviews ?? 0;
    const done = reviewedCount;
    const pct =
      sessionSize > 0 ? Math.min(100, Math.round((done / sessionSize) * 100)) : 0;

    return (
      <div className="flex min-h-[calc(100dvh-8.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-gray-400">
            <button
              type="button"
              onClick={backToSetup}
              className="rounded-md px-2 py-0.5 text-gray-500 transition hover:bg-gray-100"
            >
              ← 中断
            </button>
            <span>
              {done} / {sessionSize} ・ 残り {queue.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div
          key={current.id}
          className="flex min-h-0 flex-1 animate-pop flex-col items-center justify-start gap-3 overflow-y-auto rounded-3xl border border-black/5 bg-white p-6 pt-8 text-center shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${kindMeta.badgeClass}`}
            >
              {kindMeta.label}
            </span>
          </div>
          <p className="text-3xl font-bold break-words">{current.term}</p>
          {current.part_of_speech && (
            <span className="text-xs font-medium text-gray-400">
              {current.part_of_speech}
            </span>
          )}

          {revealed && (
            <div className="mt-2 flex w-full animate-fade flex-col gap-3 border-t border-gray-100 pt-4">
              {current.reading && (
                <p className="text-sm text-gray-400">{current.reading}</p>
              )}
              <p className="whitespace-pre-wrap text-base font-medium text-gray-800">
                {current.meaning}
              </p>
              {current.example && (
                <div className={`rounded-xl ${meta.softClass} px-3 py-2.5 text-left`}>
                  <p className="text-sm text-gray-800">{current.example}</p>
                  {current.example_translation && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {current.example_translation}
                    </p>
                  )}
                </div>
              )}
              {current.notes && (
                <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-700">
                  {current.notes}
                </p>
              )}
              <p className="text-[11px] text-gray-400">
                これまで {totalReviews} 回復習
                {totalReviews > 0 &&
                  ` ・ 正答率 ${Math.round((correctReviews / totalReviews) * 100)}%`}
              </p>
            </div>
          )}
        </div>

        <div className="grid h-[8.5rem] shrink-0 grid-cols-2 grid-rows-2 gap-2">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="col-span-2 row-span-2 rounded-xl bg-indigo-600 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99]"
            >
              答えを見る
            </button>
          ) : (
            GRADES.map(({ grade, label, className }) => (
              <button
                key={grade}
                type="button"
                onClick={() => handleGrade(grade)}
                className={`flex animate-fade flex-col items-center justify-center gap-0.5 rounded-xl border font-semibold transition active:scale-[0.97] ${className}`}
              >
                <span>{label}</span>
                <span className="text-[11px] font-normal opacity-70">
                  {nextIntervalLabel(current, grade)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────
  // 設定画面
  // ───────────────────────────────────────────────
  const dueAllCount = allWords.filter(
    (w) => new Date(w.srs_due) <= new Date(),
  ).length;

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">復習セット</h1>
        <span className="text-xs text-gray-400">
          今日の復習: {dueAllCount} 枚
        </span>
      </div>

      {/* 範囲 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">範囲</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">フォルダ</span>
          <select
            value={folderFilter}
            onChange={(e) =>
              setFolderFilter(e.target.value as FolderFilter)
            }
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="all">📁 すべてのフォルダ</option>
            <option value="none">📂 フォルダなし</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
          {folderFilter !== "all" && folderFilter !== "none" && (
            <Link
              href={`/practice?folder=${folderFilter}`}
              className="mt-1 inline-flex items-center gap-1.5 self-start rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition active:scale-[0.97]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5zM18.5 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
              </svg>
              この単語で実践文を作る
            </Link>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">言語</span>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
            {(["all", "en", "ko"] as LangFilter[]).map((v) => {
              const active = langFilter === v;
              const label =
                v === "all" ? "すべて" : v === "en" ? "英語" : "한국어";
              const textClass =
                v === "en"
                  ? LANGUAGE_META.en.textClass
                  : v === "ko"
                    ? LANGUAGE_META.ko.textClass
                    : "text-indigo-600";
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLangFilter(v)}
                  className={`flex-1 rounded-lg py-2 transition ${
                    active ? `bg-white shadow-sm ${textClass}` : "text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">区分</span>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
            {(["all", "word", "idiom"] as KindFilter[]).map((v) => {
              const active = kindFilter === v;
              const label =
                v === "all" ? "すべて" : v === "word" ? "単語" : "イディオム";
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setKindFilter(v)}
                  className={`flex-1 rounded-lg py-2 transition ${
                    active
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </label>
      </section>

      {/* 対象と並び順 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">対象と並び</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">対象</span>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
            {(
              [
                { v: "due", label: "今日の復習" },
                { v: "all", label: "すべての単語" },
              ] as { v: Scope; label: string }[]
            ).map(({ v, label }) => {
              const active = scope === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setScope(v)}
                  className={`flex-1 rounded-lg py-2 transition ${
                    active
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400">
            「今日の復習」は復習予定日が今日以前のものだけ。
            「すべての単語」は予定日を無視して全件から出題します。
          </p>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">並び順</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "due_asc", label: "期日が近い順" },
                { v: "new_first", label: "新しい順" },
                { v: "shuffle", label: "シャッフル" },
              ] as { v: Order; label: string }[]
            ).map(({ v, label }) => {
              const active = order === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setOrder(v)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "border border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </label>
      </section>

      {/* 問題数 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">問題数</h2>
        <div className="flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((n) => {
            const active = size === n;
            const label = n === 0 ? "すべて" : `${n} 枚`;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSize(n)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          対象 <span className="font-semibold text-gray-700">{eligible.length}</span> 枚 → このセットは{" "}
          <span className="font-semibold text-indigo-600">{previewCount}</span> 枚出題
        </p>
      </section>

      {allWords.length === 0 ? (
        <Link
          href="/add"
          className="rounded-xl bg-indigo-600 py-3.5 text-center font-semibold text-white shadow-sm shadow-indigo-500/25"
        >
          単語を追加する
        </Link>
      ) : (
        <button
          type="button"
          onClick={startSession}
          disabled={previewCount === 0}
          className="rounded-xl bg-indigo-600 py-3.5 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] disabled:opacity-40"
        >
          {previewCount === 0
            ? "対象がありません"
            : `${previewCount} 枚で開始`}
        </button>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div />}>
      <ReviewPageInner />
    </Suspense>
  );
}
