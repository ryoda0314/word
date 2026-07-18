"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { phaseOf } from "@/lib/srs";
import {
  KIND_META,
  LANGUAGE_META,
  SRS_PHASE_META,
  type Folder,
  type Kind,
  type Language,
  type Word,
} from "@/lib/types";

type Props = {
  word: Word;
  onChanged: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
};

const FIELD =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

function dueInfo(srsDue: string) {
  const due = new Date(srsDue);
  const now = new Date();
  if (due.getTime() <= now.getTime())
    return { label: "今日が復習日です", due: true };
  // 期日はローカル0時に揃っているので、日付単位の差で表示する
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(due);
  startOfDue.setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / 86400000,
  );
  if (days <= 0) return { label: "今日が復習日です", due: true };
  if (days === 1) return { label: "次の復習は明日", due: false };
  return { label: `次の復習まで約 ${days} 日`, due: false };
}

export default function WordCard({
  word,
  onChanged,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [form, setForm] = useState({
    term: word.term,
    language: word.language,
    kind: word.kind ?? "word",
    folder_id: word.folder_id ?? "",
    reading: word.reading ?? "",
    part_of_speech: word.part_of_speech ?? "",
    meaning: word.meaning,
    example: word.example ?? "",
    example_translation: word.example_translation ?? "",
    notes: word.notes ?? "",
  });

  useEffect(() => {
    if (!editing) return;
    const supabase = createClient();
    supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setFolders((data as Folder[]) ?? []));
  }, [editing]);

  const meta = LANGUAGE_META[word.language];
  const kindMeta = KIND_META[word.kind ?? "word"];
  const due = dueInfo(word.srs_due);
  const totalReviews = word.total_reviews ?? 0;
  const correctReviews = word.correct_reviews ?? 0;
  const accuracy =
    totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : null;
  const phaseMeta =
    totalReviews === 0
      ? { label: "新規", badgeClass: "bg-blue-100 text-blue-700" }
      : SRS_PHASE_META[phaseOf(word)];

  async function handleSave() {
    if (!form.term.trim() || !form.meaning.trim()) {
      setError("単語と意味は必須です");
      return;
    }
    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("words")
      .update({
        term: form.term.trim(),
        language: form.language,
        kind: form.kind,
        folder_id: form.folder_id || null,
        reading: form.reading.trim() || null,
        part_of_speech: form.part_of_speech.trim() || null,
        meaning: form.meaning.trim(),
        example: form.example.trim() || null,
        example_translation: form.example_translation.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", word.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm(`「${word.term}」を削除しますか？`)) return;
    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("words")
      .delete()
      .eq("id", word.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm ring-4 ring-indigo-500/5">
        <div className="flex gap-2">
          <input
            value={form.term}
            onChange={(e) => setForm({ ...form, term: e.target.value })}
            placeholder="単語"
            className={FIELD}
          />
          <select
            value={form.language}
            onChange={(e) =>
              setForm({ ...form, language: e.target.value as Language })
            }
            className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm outline-none"
          >
            <option value="en">英語</option>
            <option value="ko">韓国語</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as Kind })
            }
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm outline-none"
          >
            <option value="word">単語</option>
            <option value="idiom">イディオム</option>
          </select>
          <select
            value={form.folder_id}
            onChange={(e) =>
              setForm({ ...form, folder_id: e.target.value })
            }
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-sm outline-none"
          >
            <option value="">フォルダなし</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <input
          value={form.reading}
          onChange={(e) => setForm({ ...form, reading: e.target.value })}
          placeholder="発音・読み"
          className={FIELD}
        />
        <input
          value={form.part_of_speech}
          onChange={(e) =>
            setForm({ ...form, part_of_speech: e.target.value })
          }
          placeholder="品詞"
          className={FIELD}
        />
        <textarea
          value={form.meaning}
          onChange={(e) => setForm({ ...form, meaning: e.target.value })}
          placeholder="意味"
          rows={2}
          className={`${FIELD} resize-y`}
        />
        <textarea
          value={form.example}
          onChange={(e) => setForm({ ...form, example: e.target.value })}
          placeholder="例文"
          rows={2}
          className={`${FIELD} resize-y`}
        />
        <textarea
          value={form.example_translation}
          onChange={(e) =>
            setForm({ ...form, example_translation: e.target.value })
          }
          placeholder="例文の訳"
          rows={2}
          className={`${FIELD} resize-y`}
        />
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="メモ"
          rows={2}
          className={`${FIELD} resize-y`}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError("");
            }}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-500"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
        selectionMode && selected
          ? "border-indigo-400 ring-4 ring-indigo-500/10"
          : "border-black/5"
      }`}
    >
      <button
        type="button"
        onClick={() =>
          selectionMode ? onToggleSelect?.() : setExpanded((v) => !v)
        }
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        {selectionMode && (
          <span
            className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              selected
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 bg-white"
            }`}
          >
            {selected && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
        )}
        <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
              >
                {meta.label}
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kindMeta.badgeClass}`}
              >
                {kindMeta.label}
              </span>
              {word.part_of_speech && (
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  {word.part_of_speech}
                </span>
              )}
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${phaseMeta.badgeClass}`}
              >
                {phaseMeta.label}
              </span>
              {due.due && (
                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  復習日
                </span>
              )}
            </div>
            <p className="mt-1.5 text-lg font-bold leading-snug break-words">
              {word.term}
            </p>
            {word.reading && (
              <p className="text-xs text-gray-400">{word.reading}</p>
            )}
          </div>
          {!selectionMode && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`mt-1 h-4 w-4 shrink-0 text-gray-300 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
          {word.meaning}
        </p>
        </div>
      </button>

      {expanded && !selectionMode && (
        <div className="flex animate-fade flex-col gap-2.5 border-t border-gray-100 px-4 pt-3 pb-4">
          {word.example && (
            <div className={`rounded-xl ${meta.softClass} px-3 py-2.5`}>
              <p className="text-sm text-gray-800">{word.example}</p>
              {word.example_translation && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {word.example_translation}
                </p>
              )}
            </div>
          )}
          {word.notes && (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              {word.notes}
            </p>
          )}
          {/* 学習データ */}
          <div className="grid grid-cols-4 gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-center">
            <div>
              <p className="text-[10px] font-medium text-gray-400">復習回数</p>
              <p className="text-base font-bold tabular-nums">
                {totalReviews}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400">正答率</p>
              <p className="text-base font-bold tabular-nums">
                {accuracy === null ? "—" : `${accuracy}%`}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400">間隔</p>
              <p className="text-base font-bold tabular-nums">
                {word.srs_interval >= 1 ? `${word.srs_interval}日` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-400">忘れ</p>
              <p className="text-base font-bold tabular-nums">
                {word.srs_lapses}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">{due.label}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition active:scale-[0.98]"
            >
              編集
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition active:scale-[0.98] disabled:opacity-50"
            >
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
