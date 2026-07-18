"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Memo } from "@/lib/types";

const FIELD =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

// メモ本文を「一括追加用JSONに変換して」というプロンプトで包む。
// ChatGPT に貼れば /import にそのまま貼れる JSON が返ってくる想定。
function buildImportPrompt(content: string): string {
  return `以下は私が語学学習中に書き溜めた単語・表現のメモです。これを単語帳アプリの一括追加用 JSON 配列に変換してください。

【出力形式】
[
  {
    "term": "見出し語（必須）",
    "language": "en または ko（必須）",
    "kind": "word または idiom",
    "folder": "フォルダ名（任意）",
    "reading": "発音・読み（任意）",
    "part_of_speech": "品詞（任意。慣用句・慣用表現などは idiom に分類）",
    "meaning": "日本語の意味（必須）",
    "example": "例文（任意）",
    "example_translation": "例文の訳（任意）",
    "notes": "覚え方などのメモ（任意）"
  }
]

【ルール】
- term と meaning は必須。分からない項目は適切に補ってよい。
- 慣用句・イディオム・表現は "kind": "idiom" にする。
- 出力は JSON 配列のみ。前後の説明やコードフェンス(\`\`\`)は不要。

【メモ】
${content}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

function previewText(memo: Memo): string {
  const body = memo.content.trim();
  if (memo.title && memo.title.trim()) return memo.title.trim();
  const firstLine = body.split("\n").find((l) => l.trim() !== "");
  return firstLine?.trim() || "（空のメモ）";
}

type SaveStatus = "idle" | "saving" | "saved";

export default function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"plain" | "prompt" | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("memos")
      .select("*")
      .order("updated_at", { ascending: false });
    setMemos((data as Memo[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = memos.find((m) => m.id === selectedId) ?? null;

  // 選択中メモが変わったら下書きを同期
  useEffect(() => {
    if (selected) {
      setDraftTitle(selected.title ?? "");
      setDraftContent(selected.content);
      setStatus("idle");
      setCopied(null);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // デバウンス自動保存。開いた直後（値が一致）は保存しない
  useEffect(() => {
    if (!selectedId || !selected) return;
    if (
      (selected.title ?? "") === draftTitle &&
      selected.content === draftContent
    ) {
      return;
    }
    setStatus("saving");
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("memos")
        .update({
          title: draftTitle.trim() || null,
          content: draftContent,
          updated_at: nowIso,
        })
        .eq("id", selectedId);
      if (updateError) {
        setError(updateError.message);
        setStatus("idle");
        return;
      }
      setMemos((arr) =>
        arr
          .map((m) =>
            m.id === selectedId
              ? {
                  ...m,
                  title: draftTitle.trim() || null,
                  content: draftContent,
                  updated_at: nowIso,
                }
              : m,
          )
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      );
      setStatus("saved");
    }, 900);
    return () => clearTimeout(timer);
  }, [draftTitle, draftContent, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNew() {
    setError("");
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("memos")
      .insert({ content: "" })
      .select("*")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const memo = data as Memo;
    setMemos((arr) => [memo, ...arr]);
    setSelectedId(memo.id);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("このメモを削除しますか？")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("memos")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setMemos((arr) => arr.filter((m) => m.id !== id));
    setSelectedId(null);
  }

  async function copy(kind: "plain" | "prompt") {
    const text =
      kind === "prompt" ? buildImportPrompt(draftContent) : draftContent;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("クリップボードにコピーできませんでした");
    }
  }

  // ───────────── 編集画面 ─────────────
  if (selected) {
    return (
      <div className="flex animate-rise flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
            メモ一覧
          </button>
          <span className="text-xs text-gray-400">
            {status === "saving"
              ? "保存中…"
              : status === "saved"
                ? "✓ 保存済み"
                : ""}
          </span>
        </div>

        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="タイトル（任意）"
          className={`${FIELD} font-semibold`}
        />

        <textarea
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          placeholder={
            "気になった単語や表現をどんどん書き留めましょう。\n\n例:\nresilient 立ち直りが早い\n반갑다 会えてうれしい\n\n書いたら「ChatGPT用にコピー」で変換プロンプトごとコピーできます。"
          }
          className={`${FIELD} min-h-[45dvh] resize-y leading-relaxed`}
        />

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => copy("prompt")}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-3 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5zM18.5 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" />
            </svg>
            {copied === "prompt" ? "コピーしました" : "ChatGPT用にコピー"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copy("plain")}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition active:scale-[0.98]"
            >
              {copied === "plain" ? "コピーしました" : "本文だけコピー"}
            </button>
            <Link
              href="/import"
              className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-center text-sm font-semibold text-indigo-700 transition active:scale-[0.98]"
            >
              一括追加へ
            </Link>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(selected.id)}
            className="rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 transition active:scale-[0.98]"
          >
            このメモを削除
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          「ChatGPT用にコピー」→ ChatGPTに貼り付け → 返ってきたJSONを「一括追加」に貼るとまとめて登録できます。
        </p>
      </div>
    );
  }

  // ───────────── 一覧画面 ─────────────
  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">メモ</h1>
        <button
          type="button"
          onClick={handleNew}
          className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新規
        </button>
      </div>
      <p className="text-xs text-gray-500">
        単語や表現を書き留めておく場所。あとで ChatGPT
        に投げて一括追加用のデータに変換できます。
      </p>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : memos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M4 4h16v12H8l-4 4z" />
              <path d="M8 9h8M8 12h5" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">まだメモがありません</p>
          <button
            type="button"
            onClick={handleNew}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25"
          >
            メモを作る
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {memos.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{previewText(m)}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {formatDate(m.updated_at)}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-gray-300">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
