"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  LANGUAGE_META,
  type Folder,
  type Kind,
  type Language,
} from "@/lib/types";

type Form = {
  term: string;
  reading: string;
  part_of_speech: string;
  meaning: string;
  example: string;
  example_translation: string;
  notes: string;
};

const EMPTY: Form = {
  term: "",
  reading: "",
  part_of_speech: "",
  meaning: "",
  example: "",
  example_translation: "",
  notes: "",
};

const FIELD =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

export default function AddPage() {
  const [language, setLanguage] = useState<Language>("en");
  const [kind, setKind] = useState<Kind>("word");
  const [folderId, setFolderId] = useState<string>(""); // "" = フォルダなし
  const [folders, setFolders] = useState<Folder[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setFolders((data as Folder[]) ?? []));
  }, []);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.term.trim() || !form.meaning.trim()) {
      setError("単語と意味は必須です");
      return;
    }
    setError("");
    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("words").insert({
      term: form.term.trim(),
      language,
      kind,
      folder_id: folderId || null,
      reading: form.reading.trim() || null,
      part_of_speech: form.part_of_speech.trim() || null,
      meaning: form.meaning.trim(),
      example: form.example.trim() || null,
      example_translation: form.example_translation.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(EMPTY);
    setSaved(true);
  }

  const canSave = form.term.trim() !== "" && form.meaning.trim() !== "";

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">単語を追加</h1>
        <Link
          href="/import"
          className="text-sm font-semibold text-indigo-600 underline"
        >
          JSONで一括追加
        </Link>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">単語</h2>

        <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          {(["en", "ko"] as Language[]).map((lang) => {
            const active = language === lang;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`flex-1 rounded-lg py-2 transition ${
                  active
                    ? `bg-white shadow-sm ${LANGUAGE_META[lang].textClass}`
                    : "text-gray-500"
                }`}
              >
                {lang === "en" ? "英語" : "한국어"}
              </button>
            );
          })}
        </div>

        {/* 単語 / イディオムの区分 */}
        <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
          {(["word", "idiom"] as Kind[]).map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg py-2 transition ${
                  active
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {KIND_META[k].label}
              </button>
            );
          })}
        </div>

        <input
          value={form.term}
          onChange={(e) => update("term", e.target.value)}
          placeholder={
            kind === "idiom"
              ? language === "en"
                ? "例: break the ice"
                : "例: 시간 가는 줄 모르고"
              : language === "en"
                ? "例: resilient"
                : "例: 반갑다"
          }
          className={FIELD}
        />
      </section>

      {/* フォルダ選択（任意） */}
      <section className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">フォルダ</h2>
          <Link
            href="/folders"
            className="text-xs font-semibold text-indigo-600 underline"
          >
            管理
          </Link>
        </div>
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className={FIELD}
        >
          <option value="">フォルダなし</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">内容</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">発音・読み</span>
          <input
            value={form.reading}
            onChange={(e) => update("reading", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">品詞</span>
          <input
            value={form.part_of_speech}
            onChange={(e) => update("part_of_speech", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">
            意味 <span className="text-red-500">*</span>
          </span>
          <textarea
            value={form.meaning}
            onChange={(e) => update("meaning", e.target.value)}
            rows={2}
            className={`${FIELD} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">例文</span>
          <textarea
            value={form.example}
            onChange={(e) => update("example", e.target.value)}
            rows={2}
            className={`${FIELD} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">例文の訳</span>
          <textarea
            value={form.example_translation}
            onChange={(e) => update("example_translation", e.target.value)}
            rows={2}
            className={`${FIELD} resize-y`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">メモ</span>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={2}
            placeholder="覚えるためのヒントなど（任意）"
            className={`${FIELD} resize-y`}
          />
        </label>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <span>保存しました</span>
          <Link href="/words" className="font-semibold underline">
            一覧で見る
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !canSave}
        className="rounded-xl bg-indigo-600 py-3.5 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] disabled:opacity-40"
      >
        {saving ? "保存中…" : canSave ? "保存する" : "単語を入力してください"}
      </button>
    </div>
  );
}
