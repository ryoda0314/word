"use client";

import { useMemo } from "react";
import {
  countLocalToday,
  remainingNewAllowance,
  useNewLimit,
} from "@/lib/settings";

type Props = {
  // 復習イベントのタイムスタンプ（直近8日ぶん。review_logs 由来、無ければ last_reviewed）
  isoDates: string[];
  // 期日到来のうち未学習（新規）の枚数
  dueNew: number;
  // 期日到来のうち学習済み（学習中 + 復習）の枚数
  dueOther: number;
  // 直近の新規導入ログの時刻（今日の新規消費数を出す）
  newLogTimes: string[];
  // 今後7日以内に期日が来る単語の srs_due（今日超過ぶんは含まない）
  upcomingDue: string[];
  // 直近7日間の定着率（again 以外の割合、%）。ログが無ければ null
  retention: number | null;
};

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export default function StudyIndicator({
  isoDates,
  dueNew,
  dueOther,
  newLogTimes,
  upcomingDue,
  retention,
}: Props) {
  // 「今日の復習」は新規を1日上限までしか数えない（DueTodayCard と同じ計算）
  const [newLimit] = useNewLimit();
  const dueCount =
    dueOther +
    Math.min(
      dueNew,
      remainingNewAllowance(newLimit, countLocalToday(newLogTimes)),
    );
  // タイムゾーンはユーザーのローカル基準。クライアント側で日付バケットを作る
  const { todayCount, days, forecast } = useMemo(() => {
    const counts = new Map<string, number>();
    isoDates.forEach((s) => {
      const k = dayKey(new Date(s));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = counts.get(dayKey(today)) ?? 0;

    const days: {
      key: string;
      label: string;
      count: number;
      today: boolean;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      days.push({
        key: k,
        label: WEEK[d.getDay()],
        count: counts.get(k) ?? 0,
        today: i === 0,
      });
    }

    // 今後7日の復習予定。今日は「残り枚数」、明日以降は期日ベース
    const dueBuckets = new Map<string, number>();
    upcomingDue.forEach((s) => {
      const k = dayKey(new Date(s));
      dueBuckets.set(k, (dueBuckets.get(k) ?? 0) + 1);
    });
    const forecast: {
      key: string;
      label: string;
      count: number;
      today: boolean;
    }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const k = dayKey(d);
      forecast.push({
        key: k,
        label: i === 0 ? "今日" : WEEK[d.getDay()],
        count: i === 0 ? dueCount : (dueBuckets.get(k) ?? 0),
        today: i === 0,
      });
    }

    return { todayCount, days, forecast };
  }, [isoDates, upcomingDue, dueCount]);

  const status =
    dueCount === 0 && todayCount > 0
      ? "今日の復習は完了"
      : todayCount === 0
        ? dueCount > 0
          ? "今日はまだです"
          : "復習対象はありません"
        : `あと ${dueCount} 枚`;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">今日の学習</p>
          <p className="mt-1 flex items-end gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {todayCount}
            </span>
            <span className="pb-0.5 text-xs text-gray-500">回復習</span>
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] text-gray-400">{status}</span>
          {retention !== null && (
            <span className="mt-0.5 block text-[11px] font-semibold text-emerald-600">
              7日間の定着率 {retention}%
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-1.5">
        {days.map((d) => {
          // 件数で色の濃さを決める（GitHub風のヒートマップ）
          const intensity =
            d.count === 0
              ? "bg-gray-100"
              : d.count < 3
                ? "bg-indigo-200"
                : d.count < 8
                  ? "bg-indigo-400"
                  : "bg-indigo-600";
          return (
            <div
              key={d.key}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className={`h-7 w-full rounded-lg ${intensity} ${
                  d.today ? "outline outline-2 outline-offset-2 outline-indigo-500" : ""
                }`}
                title={`${d.key}: ${d.count} 回`}
              />
              <span
                className={`text-[10px] ${
                  d.today
                    ? "font-bold text-indigo-600"
                    : "text-gray-400"
                }`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 忘却曲線が生む「これから来る復習」の見通し */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400">今後7日の復習予定</p>
        <div className="mt-2 flex justify-between gap-1.5">
          {forecast.map((f) => (
            <div
              key={f.key}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div
                className={`flex h-7 w-full items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                  f.count === 0
                    ? "bg-gray-50 text-gray-300"
                    : f.today
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-700"
                }`}
                title={`${f.key}: ${f.count} 枚`}
              >
                {f.count}
              </div>
              <span
                className={`text-[10px] ${
                  f.today ? "font-bold text-indigo-600" : "text-gray-400"
                }`}
              >
                {f.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
