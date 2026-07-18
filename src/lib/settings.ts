// 学習設定（クライアント側で localStorage に保存する）

import { useCallback, useSyncExternalStore } from "react";

// 1日に新しく学習を始めるカードの上限（Anki の「新規カード/日」に相当）。0 = 無制限
export const DEFAULT_NEW_LIMIT = 20;
export const NEW_LIMIT_OPTIONS = [10, 20, 50, 0] as const;

const NEW_LIMIT_KEY = "wordstock:daily-new-limit";

export function loadNewLimit(): number {
  if (typeof window === "undefined") return DEFAULT_NEW_LIMIT;
  try {
    const raw = window.localStorage.getItem(NEW_LIMIT_KEY);
    if (raw === null) return DEFAULT_NEW_LIMIT;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_NEW_LIMIT;
  } catch {
    return DEFAULT_NEW_LIMIT;
  }
}

export function saveNewLimit(n: number) {
  try {
    window.localStorage.setItem(NEW_LIMIT_KEY, String(n));
  } catch {
    // プライベートモード等で保存できなくても致命的ではない
  }
}

// localStorage を外部ストアとして購読する（SSR 中はデフォルト値、別タブの変更にも追従）
const limitListeners = new Set<() => void>();

function subscribeNewLimit(onChange: () => void) {
  limitListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    limitListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useNewLimit(): [number, (n: number) => void] {
  const limit = useSyncExternalStore(
    subscribeNewLimit,
    loadNewLimit,
    () => DEFAULT_NEW_LIMIT,
  );
  const update = useCallback((n: number) => {
    saveNewLimit(n);
    limitListeners.forEach((l) => l());
  }, []);
  return [limit, update];
}

// タイムスタンプ列のうち「ローカル時間で今日」の件数を数える
export function countLocalToday(times: string[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 86400000;
  return times.filter((s) => {
    const t = new Date(s).getTime();
    return t >= startMs && t < endMs;
  }).length;
}

// 今日あと何枚の新規カードを始められるか
export function remainingNewAllowance(
  limit: number,
  introducedToday: number,
): number {
  if (limit === 0) return Infinity;
  return Math.max(0, limit - introducedToday);
}
