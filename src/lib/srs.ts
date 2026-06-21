// SM-2 ベースの間隔反復アルゴリズム

export type Grade = "again" | "hard" | "good" | "easy";

export type SrsState = {
  srs_reps: number;
  srs_interval: number;
  srs_ease: number;
  srs_lapses: number;
};

export type SrsUpdate = SrsState & {
  srs_due: string;
  last_reviewed: string;
};

const GRADE_QUALITY: Record<Grade, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

// 採点を反映した次回の SRS 状態を計算する
export function applyGrade(state: SrsState, grade: Grade): SrsUpdate {
  const quality = GRADE_QUALITY[grade];
  let { srs_reps, srs_interval, srs_ease, srs_lapses } = state;

  if (quality < 3) {
    // 不正解：最初からやり直し
    srs_reps = 0;
    srs_interval = 0;
    srs_lapses += 1;
  } else {
    if (srs_reps === 0) {
      srs_interval = 1;
    } else if (srs_reps === 1) {
      srs_interval = 6;
    } else {
      srs_interval = Math.round(srs_interval * srs_ease);
    }
    if (grade === "hard") {
      srs_interval = Math.max(1, Math.round(srs_interval * 0.6));
    }
    if (grade === "easy") {
      srs_interval = Math.round(srs_interval * 1.3);
    }
    srs_reps += 1;
  }

  srs_ease = srs_ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (srs_ease < 1.3) srs_ease = 1.3;

  const now = new Date();
  const due = new Date(now);
  if (srs_interval === 0) {
    // すぐに再出題（同セッション内）
    due.setMinutes(due.getMinutes() + 1);
  } else {
    due.setDate(due.getDate() + srs_interval);
  }

  return {
    srs_reps,
    srs_interval,
    srs_ease: Math.round(srs_ease * 100) / 100,
    srs_lapses,
    srs_due: due.toISOString(),
    last_reviewed: now.toISOString(),
  };
}

// 採点ボタンに表示する「次はいつ復習か」のラベル
export function nextIntervalLabel(state: SrsState, grade: Grade): string {
  const next = applyGrade(state, grade);
  if (next.srs_interval === 0) return "1分後";
  if (next.srs_interval === 1) return "1日後";
  return `${next.srs_interval}日後`;
}
