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
  srs_due: string;
  last_reviewed: string | null;
  total_reviews: number;
  correct_reviews: number;
  created_at: string;
};

export type GeneratedWord = {
  term: string;
  reading: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  example_translation: string;
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
