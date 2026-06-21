"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Folder } from "@/lib/types";

type FolderRow = Folder & { word_count: number };

const FIELD =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: folderData }, { data: wordData }] = await Promise.all([
      supabase
        .from("folders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("words").select("folder_id"),
    ]);
    const counts = new Map<string, number>();
    ((wordData as { folder_id: string | null }[]) ?? []).forEach((w) => {
      if (w.folder_id) counts.set(w.folder_id, (counts.get(w.folder_id) ?? 0) + 1);
    });
    const rows = ((folderData as Folder[]) ?? []).map((f) => ({
      ...f,
      word_count: counts.get(f.id) ?? 0,
    }));
    setFolders(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("folders")
      .insert({ name });
    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewName("");
    load();
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("folders")
      .update({ name })
      .eq("id", id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    setEditingName("");
    load();
  }

  async function handleDelete(f: FolderRow) {
    const msg =
      f.word_count > 0
        ? `「${f.name}」を削除しますか？\n中の ${f.word_count} 語はフォルダなしになります（単語自体は消えません）。`
        : `「${f.name}」を削除しますか？`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("folders")
      .delete()
      .eq("id", f.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  return (
    <div className="flex animate-rise flex-col gap-4">
      <h1 className="text-xl font-bold tracking-tight">フォルダ</h1>

      <section className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">新しいフォルダ</h2>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例: TOEIC、韓国語ドラマ"
            className={`${FIELD} flex-1`}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || newName.trim() === ""}
            className="shrink-0 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.97] disabled:opacity-40"
          >
            作成
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 w-full rounded-2xl bg-white shadow-sm"
            />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">
            まだフォルダがありません。上で作成してください。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {folders.map((f) => {
            const isEditing = editingId === f.id;
            return (
              <div
                key={f.id}
                className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={FIELD}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                        className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-500"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRename(f.id)}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/words?folder=${f.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        </svg>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{f.name}</span>
                        <span className="text-xs text-gray-400">
                          {f.word_count} 語
                        </span>
                      </span>
                    </Link>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(f.id);
                          setEditingName(f.name);
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
