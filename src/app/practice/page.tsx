"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGE_META, type Folder, type Language } from "@/lib/types";

type Result = {
  passage: string;
  translation: string;
  language: "en" | "ko";
  usedIds: string[];
  words: Record<string, { term: string; meaning: string }>;
};

type FolderWord = {
  id: string;
  term: string;
  language: Language;
};

// 壊れたタグの破片（マッチしなかった「<w ...>」「</w>」「< w id ...」など）を除去
function stripTagDebris(s: string): string {
  return s.replace(/<\s*\/?\s*w[^>]*>?/gi, "");
}

function parsePassage(passage: string): { text: string; id: string | null }[] {
  // <w id="...">...</w> を分解。GPTが「< w id ... >」のように余分な空白を入れる
  // ケースや、シングルクォートを使うケースにも寛容にマッチさせる
  const regex =
    /<\s*w\s+id\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\s*\/\s*w\s*>/gi;
  const parts: { text: string; id: string | null }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(passage)) !== null) {
    if (m.index > lastIndex) {
      const t = stripTagDebris(passage.slice(lastIndex, m.index));
      if (t) parts.push({ text: t, id: null });
    }
    parts.push({ text: m[2], id: m[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < passage.length) {
    const t = stripTagDebris(passage.slice(lastIndex));
    if (t) parts.push({ text: t, id: null });
  }
  return parts;
}

function PracticeInner() {
  const params = useSearchParams();
  const initialFolder = params.get("folder") ?? "";

  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState(initialFolder);
  const [folderWords, setFolderWords] = useState<FolderWord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null); // 保存済みなら DB の id
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setFolders((data as Folder[]) ?? []));
  }, []);

  // フォルダが変わるたびに、そのフォルダの単語をロードして選択をリセット
  useEffect(() => {
    if (!folderId) {
      setFolderWords([]);
      setSelectedIds(new Set());
      return;
    }
    const supabase = createClient();
    supabase
      .from("words")
      .select("id, term, language")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFolderWords((data as FolderWord[]) ?? []);
        setSelectedIds(new Set());
      });
  }, [folderId]);

  function toggleWord(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(folderWords.map((w) => w.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectRandom(n: number) {
    const shuffled = folderWords
      .map((w) => [Math.random(), w] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, w]) => w);
    setSelectedIds(
      new Set(shuffled.slice(0, Math.min(n, shuffled.length)).map((w) => w.id)),
    );
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) return;
    setError("");
    setLoading(true);
    setResult(null);
    setSavedId(null);
    setActiveId(null);
    setShowTranslation(false);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          wordIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      setResult(data as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || savedId) return;
    setSaving(true);
    setError("");
    const folderName =
      folders.find((f) => f.id === folderId)?.name ?? null;
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("practice_passages")
      .insert({
        folder_id: folderId || null,
        folder_name: folderName,
        language: result.language,
        passage: result.passage,
        translation: result.translation,
        used_ids: result.usedIds,
        words: result.words,
      })
      .select("id")
      .single();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) setSavedId((data as { id: string }).id);
  }

  const activeWord = activeId && result ? result.words[activeId] : null;
  const folderName =
    folders.find((f) => f.id === folderId)?.name ?? "";

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">実践文</h1>
        <div className="flex items-baseline gap-3 text-xs font-semibold">
          <Link href="/practice/history" className="text-indigo-600 underline">
            履歴
          </Link>
          <Link href="/folders" className="text-indigo-600 underline">
            フォルダ管理
          </Link>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        フォルダ内の単語を使って AI が短い実践文を作ります。
        下線の単語をタップすると意味が出ます。
      </p>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">フォルダ</span>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="">フォルダを選択</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
        </label>

        {folderId && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                使う単語（タップして選択）
              </span>
              <span className="text-xs text-gray-400">
                選択中 {selectedIds.size} / {folderWords.length}
              </span>
            </div>

            {folderWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600"
                >
                  クリア
                </button>
                {[5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => selectRandom(n)}
                    disabled={folderWords.length < 1}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 disabled:opacity-40"
                  >
                    ランダム{n}
                  </button>
                ))}
              </div>
            )}

            {folderWords.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">
                このフォルダには単語がありません
              </p>
            ) : (
              <div className="flex max-h-64 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
                {folderWords.map((w) => {
                  const active = selectedIds.has(w.id);
                  const meta = LANGUAGE_META[w.language];
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => toggleWord(w.id)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          active ? "bg-white/70" : meta.dotClass
                        }`}
                      />
                      {w.term}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedIds.size > 20 && (
              <p className="text-[11px] text-amber-600">
                ⚠ 多すぎると文章が不自然になりやすいです（10〜15個が目安）
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={selectedIds.size === 0 || loading}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5zM18.5 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
          </svg>
          {loading
            ? "生成中…"
            : selectedIds.size === 0
              ? "単語を選択してください"
              : result
                ? `選んだ ${selectedIds.size} 個で再生成`
                : `${selectedIds.size} 個で文章を生成`}
        </button>
      </section>

      {loading && (
        <div className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-11/12 rounded bg-gray-100" />
          <div className="h-4 w-10/12 rounded bg-gray-100" />
          <div className="h-4 w-9/12 rounded bg-gray-100" />
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {result && (
        <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${LANGUAGE_META[result.language].badgeClass}`}
            >
              {LANGUAGE_META[result.language].label}
            </span>
            {folderName && <span>・ 📁 {folderName}</span>}
          </div>

          <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap">
            {parsePassage(result.passage).map((p, i) => {
              if (p.id && result.words[p.id]) {
                const isActive = activeId === p.id;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveId(isActive ? null : p.id)}
                    className={`rounded px-0.5 underline decoration-2 underline-offset-4 transition ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700 decoration-indigo-600"
                        : "text-indigo-600 decoration-indigo-300"
                    }`}
                  >
                    {p.text}
                  </button>
                );
              }
              return <span key={i}>{p.text}</span>;
            })}
          </div>

          {activeWord && (
            <div className="animate-fade rounded-xl bg-indigo-50 px-3 py-2.5">
              <p className="text-base font-bold text-indigo-700">
                {activeWord.term}
              </p>
              <p className="text-sm text-indigo-900">{activeWord.meaning}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 transition active:scale-[0.98]"
            >
              {showTranslation ? "日本語訳を隠す" : "日本語訳を表示"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!savedId}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${
                savedId
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700"
              }`}
            >
              {saving ? "保存中…" : savedId ? "✓ 保存済み" : "💾 保存"}
            </button>
          </div>
          {showTranslation && (
            <p className="animate-fade whitespace-pre-wrap border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
              {result.translation}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-400">使った単語:</span>
            {result.usedIds
              .map((id) => ({ id, w: result.words[id] }))
              .filter(
                (x): x is { id: string; w: { term: string; meaning: string } } =>
                  !!x.w,
              )
              .map(({ id, w }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveId(activeId === id ? null : id)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition ${
                    activeId === id
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {w.term}
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div />}>
      <PracticeInner />
    </Suspense>
  );
}
