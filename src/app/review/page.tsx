"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyGrade, nextIntervalLabel, type Grade } from "@/lib/srs";
import {
  KIND_META,
  LANGUAGE_META,
  type Folder,
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

function ReviewPageInner() {
  const params = useSearchParams();
  const folderId = params.get("folder");

  const [queue, setQueue] = useState<Word[]>([]);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let q = supabase
      .from("words")
      .select("*")
      .lte("srs_due", new Date().toISOString())
      .order("srs_due", { ascending: true });
    if (folderId) q = q.eq("folder_id", folderId);
    q.then(({ data }) => {
      setQueue((data as Word[]) ?? []);
      setLoading(false);
    });

    if (folderId) {
      supabase
        .from("folders")
        .select("*")
        .eq("id", folderId)
        .single()
        .then(({ data }) => setFolder((data as Folder | null) ?? null));
    }
  }, [folderId]);

  const current = queue[0];

  async function handleGrade(grade: Grade) {
    if (!current) return;
    const update = applyGrade(current, grade);
    const isCorrect = grade !== "again";
    const supabase = createClient();
    // 累積データも一緒に更新（SM-2 がリセットされても残る）
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
    setRevealed(false);
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

  if (loading) {
    return (
      <div className="flex animate-rise flex-col gap-4">
        <div className="h-1.5 w-full rounded-full bg-gray-200" />
        <div className="h-80 w-full rounded-2xl bg-white shadow-sm" />
        <div className="h-13 w-full rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex animate-rise flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold">復習完了</h1>
          {folder && (
            <p className="mt-0.5 text-xs text-indigo-500">📁 {folder.name}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            {reviewedCount > 0
              ? `${reviewedCount} 枚の単語を復習しました`
              : "今日復習する単語はありません"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600"
          >
            ホームへ
          </Link>
          <Link
            href="/add"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25"
          >
            単語を追加
          </Link>
        </div>
      </div>
    );
  }

  const meta = LANGUAGE_META[current.language];
  const kindMeta = KIND_META[current.kind ?? "word"];
  const totalReviews = current.total_reviews ?? 0;
  const correctReviews = current.correct_reviews ?? 0;
  const done = reviewedCount;
  const pct = Math.round((done / (done + queue.length)) * 100);

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-medium text-gray-400">
          <span>
            {folder ? `📁 ${folder.name}・` : ""}復習済み {done}
          </span>
          <span>残り {queue.length} 枚</span>
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

      {/* アクション枠は常に同じ高さ・位置。中身だけ差し替えるので採点ボタンが動かない */}
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

export default function ReviewPage() {
  return (
    <Suspense fallback={<div />}>
      <ReviewPageInner />
    </Suspense>
  );
}
