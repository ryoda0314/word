// エビングハウスの忘却曲線に基づく間隔反復スケジューラ（Anki 方式をベースに簡略化）
//
// 忘却曲線は覚えた直後がもっとも急降下するため、カードを 3 つのフェーズで管理する:
//  - learning:   覚えたての単語。当日内の短いステップ（分単位）で数回反復してから卒業する
//  - review:     卒業済み。日単位の間隔を ease 倍率で伸ばしていく
//  - relearning: 復習で忘れた単語。短いステップで覚え直してから、縮めた間隔で復習に戻す
//
// 旧データ（srs_phase が無い行）は srs_interval から自動的にフェーズを推定する。

export type Grade = "again" | "hard" | "good" | "easy";

export type SrsPhase = "learning" | "review" | "relearning";

export type SrsState = {
  srs_reps: number;
  srs_interval: number; // 復習フェーズの間隔（日）。learning 中は 0
  srs_ease: number;
  srs_lapses: number;
  srs_phase?: SrsPhase | null;
  srs_step?: number | null;
};

// words テーブルの更新カラムと 1:1 対応させる（余計なキーを入れない）
export type SrsUpdate = {
  srs_reps: number;
  srs_interval: number;
  srs_ease: number;
  srs_lapses: number;
  srs_phase: SrsPhase;
  srs_step: number;
  srs_due: string;
  last_reviewed: string;
};

// 忘却曲線の初期急降下に対応する当日内ステップ（分）
const LEARNING_STEPS_MIN = [1, 10];
const RELEARNING_STEPS_MIN = [10];

const GRADUATING_INTERVAL_DAYS = 1; // 学習ステップ卒業後の最初の間隔
const EASY_INTERVAL_DAYS = 4; // 学習中に「かんたん」で即卒業したときの間隔
const HARD_INTERVAL_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const LAPSE_INTERVAL_FACTOR = 0.5; // 忘れたら間隔を半分に縮める（ゼロには戻さない）
const LAPSE_EASE_PENALTY = 0.2;
const HARD_EASE_PENALTY = 0.15;
const EASY_EASE_BONUS = 0.15;
const MIN_EASE = 1.3;
const MAX_INTERVAL_DAYS = 365;

export function phaseOf(state: SrsState): SrsPhase {
  if (state.srs_phase) return state.srs_phase;
  return state.srs_interval >= 1 ? "review" : "learning";
}

// リーチ: 何度も忘れている単語（Anki と同じ閾値）。暗記のやり方を変えるサイン
export const LEECH_THRESHOLD = 8;

export function isLeech(state: Pick<SrsState, "srs_lapses">): boolean {
  return state.srs_lapses >= LEECH_THRESHOLD;
}

type Next = {
  reps: number;
  interval: number;
  ease: number;
  lapses: number;
  phase: SrsPhase;
  step: number;
  // 非 null なら「n 分後」の当日内再出題。null なら interval 日後
  dueMinutes: number | null;
};

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, days));
}

// fuzz なしの次状態を計算する（applyGrade とボタンラベルの共通ロジック）
function schedule(state: SrsState, grade: Grade): Next {
  const phase = phaseOf(state);
  const step = Math.max(0, state.srs_step ?? 0);
  let { srs_reps: reps, srs_interval: interval, srs_ease: ease, srs_lapses: lapses } = state;

  if (phase === "review") {
    if (grade === "again") {
      // 失念: ease を一度だけ下げ、間隔を半分に縮めて覚え直しへ
      lapses += 1;
      reps = 0;
      ease = Math.max(MIN_EASE, ease - LAPSE_EASE_PENALTY);
      interval = Math.max(1, Math.round(interval * LAPSE_INTERVAL_FACTOR));
      return { reps, interval, ease, lapses, phase: "relearning", step: 0, dueMinutes: RELEARNING_STEPS_MIN[0] };
    }
    if (grade === "hard") {
      ease = Math.max(MIN_EASE, ease - HARD_EASE_PENALTY);
      interval = clampInterval(Math.max(interval + 1, Math.round(interval * HARD_INTERVAL_FACTOR)));
    } else if (grade === "good") {
      interval = clampInterval(Math.max(interval + 1, Math.round(interval * ease)));
    } else {
      // easy: 間隔は現行 ease × ボーナスで計算してから ease を上げる
      interval = clampInterval(Math.max(interval + 2, Math.round(interval * ease * EASY_BONUS)));
      ease = ease + EASY_EASE_BONUS;
    }
    return { reps: reps + 1, interval, ease, lapses, phase: "review", step: 0, dueMinutes: null };
  }

  // learning / relearning: 当日内ステップ。ease は変更しない
  const steps = phase === "learning" ? LEARNING_STEPS_MIN : RELEARNING_STEPS_MIN;
  const cur = Math.min(step, steps.length - 1);

  if (grade === "again") {
    return { reps, interval, ease, lapses, phase, step: 0, dueMinutes: steps[0] };
  }
  if (grade === "hard") {
    // 最初のステップでの hard は again と good の中間の待ち時間にする
    const minutes =
      cur === 0 && steps.length > 1 ? Math.round((steps[0] + steps[1]) / 2) : steps[cur];
    return { reps, interval, ease, lapses, phase, step: cur, dueMinutes: minutes };
  }

  // good / easy
  const graduating = grade === "easy" || cur + 1 >= steps.length;
  if (!graduating) {
    return { reps, interval, ease, lapses, phase, step: cur + 1, dueMinutes: steps[cur + 1] };
  }
  const nextInterval =
    phase === "learning"
      ? grade === "easy"
        ? EASY_INTERVAL_DAYS
        : GRADUATING_INTERVAL_DAYS
      : // relearning 卒業: 失念時に縮めておいた間隔で復習に戻る
        clampInterval(Math.max(grade === "easy" ? 2 : 1, interval));
  return {
    reps: reps + 1,
    interval: nextInterval,
    ease,
    lapses,
    phase: "review",
    step: 0,
    dueMinutes: null,
  };
}

// 同じ日に登録した単語が毎回同じ日に固まらないよう、長い間隔に ±5% の揺らぎを入れる
function fuzzInterval(days: number): number {
  if (days < 3) return days;
  const span = Math.max(1, Math.round(days * 0.05));
  const delta = Math.floor(Math.random() * (span * 2 + 1)) - span;
  return clampInterval(days + delta);
}

// 日単位の期日はローカルの 0 時に揃える。夜に復習しても翌日の朝から出題対象になる
function dueAfterDays(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

// 採点を反映した次回の SRS 状態を計算する
export function applyGrade(state: SrsState, grade: Grade): SrsUpdate {
  const next = schedule(state, grade);
  const now = new Date();

  let due: Date;
  if (next.dueMinutes !== null) {
    due = new Date(now.getTime() + next.dueMinutes * 60000);
  } else {
    due = dueAfterDays(fuzzInterval(next.interval));
  }

  return {
    srs_reps: next.reps,
    srs_interval: next.interval,
    srs_ease: Math.round(next.ease * 100) / 100,
    srs_lapses: next.lapses,
    srs_phase: next.phase,
    srs_step: next.step,
    srs_due: due.toISOString(),
    last_reviewed: now.toISOString(),
  };
}

// 採点ボタンに表示する「次はいつ復習か」のラベル
export function nextIntervalLabel(state: SrsState, grade: Grade): string {
  const next = schedule(state, grade);
  if (next.dueMinutes !== null) return `${next.dueMinutes}分後`;
  if (next.interval === 1) return "1日後";
  if (next.interval < 3) return `${next.interval}日後`;
  if (next.interval >= 30) {
    const months = Math.round(next.interval / 30);
    return `約${months}ヶ月後`;
  }
  return `約${next.interval}日後`;
}
