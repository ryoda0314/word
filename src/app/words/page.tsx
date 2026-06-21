"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import WordCard from "@/components/WordCard";
import type { Folder, Kind, Language, Word } from "@/lib/types";

type LangFilter = "all" | Language;
type KindFilter = "all" | Kind;
type FolderFilter = "all" | "none" | string; // folder id

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="h-3 w-14 rounded bg-gray-200" />
      <div className="mt-2.5 h-5 w-28 rounded bg-gray-200" />
      <div className="mt-2.5 h-3.5 w-full rounded bg-gray-100" />
    </div>
  );
}

function WordsPageInner() {
  const params = useSearchParams();
  const initialFolder = params.get("folder") ?? "all";

  const [words, setWords] = useState<Word[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [langFilter, setLangFilter] = useState<LangFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>(initialFolder);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: wordData }, { data: folderData }] = await Promise.all([
      supabase.from("words").select("*").order("created_at", { ascending: false }),
      supabase.from("folders").select("*").order("created_at", { ascending: false }),
    ]);
    setWords((wordData as Word[]) ?? []);
    setFolders((folderData as Folder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = words.filter((w) => {
    const kind = w.kind ?? "word";
    if (langFilter !== "all" && w.language !== langFilter) return false;
    if (kindFilter !== "all" && kind !== kindFilter) return false;
    if (folderFilter === "none" && w.folder_id) return false;
    if (
      folderFilter !== "all" &&
      folderFilter !== "none" &&
      w.folder_id !== folderFilter
    )
      return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      w.term.toLowerCase().includes(q) ||
      w.meaning.toLowerCase().includes(q) ||
      (w.reading ?? "").toLowerCase().includes(q)
    );
  });

  const langCounts = {
    all: words.length,
    en: words.filter((w) => w.language === "en").length,
    ko: words.filter((w) => w.language === "ko").length,
  };
  const kindCounts = {
    all: words.length,
    word: words.filter((w) => (w.kind ?? "word") === "word").length,
    idiom: words.filter((w) => w.kind === "idiom").length,
  };

  const langFilters: { value: LangFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "en", label: "英語" },
    { value: "ko", label: "韓国語" },
  ];
  const kindFilters: { value: KindFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "word", label: "単語" },
    { value: "idiom", label: "イディオム" },
  ];

  // due-for-review レビュー対象URL（フォルダがあれば反映）
  const reviewHref =
    folderFilter !== "all" && folderFilter !== "none"
      ? `/review?folder=${folderFilter}`
      : "/review";

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">単語一覧</h1>
        <span className="text-sm text-gray-400">{filtered.length} 語</span>
      </div>

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・意味で検索"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />
      </div>

      {/* 言語フィルタ */}
      <div className="flex gap-2 overflow-x-auto">
        {langFilters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setLangFilter(f.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              langFilter === f.value
                ? "bg-indigo-600 text-white"
                : "border border-gray-200 bg-white text-gray-500"
            }`}
          >
            {f.label}
            <span
              className={
                langFilter === f.value ? "text-indigo-200" : "text-gray-300"
              }
            >
              {" "}
              {langCounts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* 単語/イディオム フィルタ */}
      <div className="flex gap-2 overflow-x-auto">
        {kindFilters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setKindFilter(f.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              kindFilter === f.value
                ? "bg-violet-600 text-white"
                : "border border-gray-200 bg-white text-gray-500"
            }`}
          >
            {f.label}
            <span
              className={
                kindFilter === f.value ? "text-violet-200" : "text-gray-300"
              }
            >
              {" "}
              {kindCounts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {/* フォルダフィルタ */}
      {folders.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value as FolderFilter)}
            className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-600 outline-none"
          >
            <option value="all">📁 すべてのフォルダ</option>
            <option value="none">📂 フォルダなし</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
          {folderFilter !== "all" && folderFilter !== "none" && (
            <Link
              href={reviewHref}
              className="shrink-0 rounded-full bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white"
            >
              復習
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2.5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">
            {words.length === 0
              ? "まだ単語がありません"
              : "条件に合う単語がありません"}
          </p>
          {words.length === 0 && (
            <Link
              href="/add"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25"
            >
              単語を追加する
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((word) => (
            <WordCard key={word.id} word={word} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WordsPage() {
  return (
    <Suspense fallback={<div />}>
      <WordsPageInner />
    </Suspense>
  );
}
