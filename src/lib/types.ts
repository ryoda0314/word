import type { Grade, SrsPhase } from "./srs";

export type Language = "en" | "ko";

export type LanguageMeta = {
  label: string;
  code: string;
  badgeClass: string;
  dotClass: string;
  softClass: string;
  textClass: string;
};

export const LANGUAGE_META: Record<Language, LanguageMeta> = {
  en: {
    label: "英語",
    code: "EN",
    badgeClass: "bg-sky-100 text-sky-700",
    dotClass: "bg-sky-500",
    softClass: "bg-sky-50",
    textClass: "text-sky-600",
  },
  ko: {
    label: "韓国語",
    code: "KO",
    badgeClass: "bg-rose-100 text-rose-700",
    dotClass: "bg-rose-500",
    softClass: "bg-rose-50",
    textClass: "text-rose-600",
  },
};

// 単語 or イディオム
export type Kind = "word" | "idiom";

export type KindMeta = {
  label: string;
  badgeClass: string;
};

export const KIND_META: Record<Kind, KindMeta> = {
  word: { label: "単語", badgeClass: "bg-slate-100 text-slate-600" },
  idiom: { label: "イディオム", badgeClass: "bg-violet-100 text-violet-700" },
};

export type Folder = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type Word = {
  id: string;
  user_id: string;
  folder_id: string | null;
  kind: Kind;
  term: string;
  language: Language;
  reading: string | null;
  part_of_speech: string | null;
  meaning: string;
  example: string | null;
  example_translation: string | null;
  notes: string | null;
  srs_reps: number;
  srs_interval: number;
  srs_ease: number;
  srs_lapses: number;
  srs_phase: SrsPhase | null;
  srs_step: number | null;
  srs_due: string;
  last_reviewed: string | null;
  total_reviews: number;
  correct_reviews: number;
  created_at: string;
};

// 学習フェーズの表示用メタ（新規 = total_reviews === 0 は phase とは別に扱う）
export const SRS_PHASE_META: Record<SrsPhase, { label: string; badgeClass: string }> = {
  learning: { label: "学習中", badgeClass: "bg-amber-100 text-amber-700" },
  relearning: { label: "覚え直し", badgeClass: "bg-orange-100 text-orange-700" },
  review: { label: "復習", badgeClass: "bg-emerald-100 text-emerald-700" },
};

// 復習ログ（1 採点 = 1 行。ヒートマップ・定着率の計算に使う）
export type ReviewLog = {
  id: string;
  user_id: string;
  word_id: string | null;
  grade: Grade;
  phase: string;
  interval_before: number;
  interval_after: number;
  ease_after: number;
  reviewed_at: string;
};

export type GeneratedWord = {
  term: string;
  reading: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  example_translation: string;
};

// メモ帳（あとで ChatGPT に投げるための下書きなど、自由記述）
export type Memo = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

// 保存された実践文（履歴に表示・再閲覧用）
export type PracticePassage = {
  id: string;
  user_id: string;
  folder_id: string | null;
  folder_name: string | null;
  language: Language;
  passage: string;
  translation: string;
  used_ids: string[];
  words: Record<string, { term: string; meaning: string }>;
  created_at: string;
};
