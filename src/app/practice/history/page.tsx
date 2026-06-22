"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGE_META, type PracticePassage } from "@/lib/types";

// /practice 側と同じ解析ロジック。タグの揺れに寛容
function stripTagDebris(s: string): string {
  return s.replace(/<\s*\/?\s*w[^>]*>?/gi, "");
}
function parsePassage(passage: string): { text: string; id: string | null }[] {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function PassageDetail({
  item,
  onDelete,
}: {
  item: PracticePassage;
  onDelete: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [busy, setBusy] = useState(false);

  const meta = LANGUAGE_META[item.language];
  const activeWord = activeId ? item.words[activeId] : null;

  async function handleDelete() {
    if (!window.confirm("この実践文を削除しますか？")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("practice_passages")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (!error) onDelete(item.id);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          {item.folder_name && <span>📁 {item.folder_name}</span>}
          <span>・ {formatDate(item.created_at)}</span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 disabled:opacity-50"
        >
          削除
        </button>
      </div>

      <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap">
        {parsePassage(item.passage).map((p, i) => {
          if (p.id && item.words[p.id]) {
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

      <button
        type="button"
        onClick={() => setShowTranslation((v) => !v)}
        className="rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600"
      >
        {showTranslation ? "日本語訳を隠す" : "日本語訳を表示"}
      </button>
      {showTranslation && (
        <p className="animate-fade whitespace-pre-wrap border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
          {item.translation}
        </p>
      )}
    </div>
  );
}

export default function PracticeHistoryPage() {
  const [items, setItems] = useState<PracticePassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderFilter, setFolderFilter] = useState<string>("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("practice_passages")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as PracticePassage[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDelete(id: string) {
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  // 履歴に出現するフォルダの集合を抽出（重複排除）
  const folderOptions = Array.from(
    new Map(
      items
        .filter((i) => i.folder_id && i.folder_name)
        .map((i) => [i.folder_id!, i.folder_name!]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  const filtered = items.filter((i) => {
    if (folderFilter === "all") return true;
    if (folderFilter === "none") return !i.folder_id;
    return i.folder_id === folderFilter;
  });

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">実践文の履歴</h1>
        <Link
          href="/practice"
          className="text-xs font-semibold text-indigo-600 underline"
        >
          新しく作る
        </Link>
      </div>

      {folderOptions.length > 0 && (
        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 outline-none"
        >
          <option value="all">すべてのフォルダ</option>
          <option value="none">フォルダなし</option>
          {folderOptions.map((f) => (
            <option key={f.id} value={f.id}>
              📁 {f.name}
            </option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">
            {items.length === 0
              ? "保存された実践文はまだありません"
              : "条件に合う実践文がありません"}
          </p>
          {items.length === 0 && (
            <Link
              href="/practice"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25"
            >
              実践文を作る
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <PassageDetail
              key={item.id}
              item={item}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
