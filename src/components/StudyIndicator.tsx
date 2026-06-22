"use client";

import { useMemo } from "react";

type Props = {
  // last_reviewed のタイムスタンプ（直近8日ぶん）
  isoDates: string[];
  // 今日まだ残っている復習枚数
  dueCount: number;
};

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export default function StudyIndicator({ isoDates, dueCount }: Props) {
  // タイムゾーンはユーザーのローカル基準。クライアント側で日付バケットを作る
  const { todayCount, days } = useMemo(() => {
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
    return { todayCount, days };
  }, [isoDates]);

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
        <span className="text-[11px] text-gray-400">{status}</span>
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
    </div>
  );
}
