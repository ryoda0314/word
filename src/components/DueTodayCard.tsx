"use client";

import Link from "next/link";
import {
  countLocalToday,
  remainingNewAllowance,
  useNewLimit,
} from "@/lib/settings";

type Props = {
  // 期日到来のうち未学習（新規）の枚数
  dueNew: number;
  // 期日到来のうち学習済み（学習中 + 復習）の枚数
  dueOther: number;
  // 直近の新規導入ログの時刻（今日すでに始めた新規の枚数を出す）
  newLogTimes: string[];
};

// 「今日の復習」カード。新規は1日上限までしか数えない（上限は localStorage 設定）
export default function DueTodayCard({ dueNew, dueOther, newLogTimes }: Props) {
  const [limit] = useNewLimit();
  const introducedToday = countLocalToday(newLogTimes);
  const allowedNew = Math.min(
    dueNew,
    remainingNewAllowance(limit, introducedToday),
  );
  const due = dueOther + allowedNew;

  return (
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
        {due > 0 && (
          <p className="mt-1.5 text-xs font-medium text-indigo-200">
            復習 {dueOther} 枚 ・ 新規 {allowedNew} 枚
            {dueNew > allowedNew && `（残り ${dueNew - allowedNew} 枚は明日以降）`}
          </p>
        )}
        <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold backdrop-blur">
          {due > 0 ? "復習をはじめる" : "今日の復習は完了"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
