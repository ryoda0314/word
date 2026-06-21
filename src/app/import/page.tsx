"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_META,
  LANGUAGE_META,
  type Folder,
  type Kind,
  type Language,
} from "@/lib/types";

// 一括追加で受け付ける1語ぶんのペイロード（DB の words テーブルに insert する形）
type WordInput = {
  term: string;
  language: Language;
  kind: Kind;
  folder_id: string | null;
  reading: string | null;
  part_of_speech: string | null;
  meaning: string;
  example: string | null;
  example_translation: string | null;
  notes: string | null;
};

type ParseResult = {
  valid: WordInput[];
  errors: string[];
};

type Defaults = {
  language: Language;
  kind: Kind;
  folderId: string;
  folders: Folder[];
};

const FIELD =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10";

const TEMPLATE = `[
  {
    "term": "resilient",
    "language": "en",
    "kind": "word",
    "folder": "TOEIC",
    "reading": "rɪˈzɪliənt",
    "part_of_speech": "形容詞",
    "meaning": "回復力のある、立ち直りが早い",
    "example": "She stayed resilient through tough times.",
    "example_translation": "彼女は苦しい時期を通して立ち直る力を失わなかった。",
    "notes": "re-(再び) + salire(跳ねる) が語源"
  },
  {
    "term": "break the ice",
    "language": "en",
    "kind": "idiom",
    "meaning": "場を和ませる、緊張をほぐす",
    "example": "He told a joke to break the ice.",
    "example_translation": "彼は場を和ませるためにジョークを言った。"
  },
  {
    "term": "시간 가는 줄 모르고",
    "language": "ko",
    "kind": "idiom",
    "folder": "韓国語スラング",
    "meaning": "時間を忘れて、時間が経つのも忘れて",
    "example": "시간 가는 줄 모르고 이야기했어.",
    "example_translation": "時間を忘れて話した。"
  }
]`;

function optStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function normalizeTop(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "words" in data) {
    const w = (data as { words: unknown }).words;
    return Array.isArray(w) ? w : [w];
  }
  return [data];
}

function scanBalanced(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return c === close ? i : -1;
    }
  }
  return -1;
}

function collectRows(text: string): { rows: unknown[]; error?: string } {
  try {
    return { rows: normalizeTop(JSON.parse(text)) };
  } catch {
    // fallthrough to lenient scan
  }

  const rows: unknown[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") {
      i++;
      continue;
    }
    const end = scanBalanced(text, i);
    if (end < 0) {
      i++;
      continue;
    }
    const chunk = text.slice(i, end + 1);
    try {
      rows.push(...normalizeTop(JSON.parse(chunk)));
      i = end + 1;
    } catch {
      i++;
    }
  }
  if (rows.length === 0) {
    return { rows: [], error: "JSON の配列・オブジェクトが見つかりませんでした" };
  }
  return { rows };
}

// kind を寛容に判定。"idiom" / "慣用句" / "イディオム" / "i" 等を idiom に寄せる
function detectKind(v: unknown, fallback: Kind): Kind {
  if (typeof v !== "string") return fallback;
  const s = v.toLowerCase();
  if (
    s.includes("idiom") ||
    s.includes("phrase") ||
    s.includes("慣用") ||
    s.includes("熟語") ||
    s.includes("イディオム")
  ) {
    return "idiom";
  }
  if (s.includes("word") || s.includes("単語")) return "word";
  return fallback;
}

// folder は ID または名前のどちらでも受け付ける（名前は完全一致で folders から検索）
function resolveFolder(
  v: unknown,
  defaultId: string,
  folders: Folder[],
): string | null {
  if (typeof v !== "string" || v.trim() === "") {
    return defaultId || null;
  }
  const t = v.trim();
  const byId = folders.find((f) => f.id === t);
  if (byId) return byId.id;
  const byName = folders.find((f) => f.name === t);
  if (byName) return byName.id;
  // 解決できないときはデフォルトを使う（ない場合 null）
  return defaultId || null;
}

function parseInput(text: string, d: Defaults): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { valid: [], errors: [] };

  const { rows: list, error } = collectRows(trimmed);
  if (error) {
    return { valid: [], errors: [`JSON として解析できませんでした: ${error}`] };
  }

  const valid: WordInput[] = [];
  const errors: string[] = [];

  list.forEach((row, i) => {
    const label = `${i + 1} 件目`;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`${label}: オブジェクトではありません`);
      return;
    }
    const r = row as Record<string, unknown>;

    const term = typeof r.term === "string" ? r.term.trim() : "";
    const meaning = typeof r.meaning === "string" ? r.meaning.trim() : "";
    if (!term) {
      errors.push(`${label}: "term"（単語）が必要です`);
      return;
    }
    if (!meaning) {
      errors.push(`${label}「${term}」: "meaning"（意味）が必要です`);
      return;
    }

    let language: Language = d.language;
    if (typeof r.language === "string" && r.language.trim() !== "") {
      const raw = r.language.toLowerCase();
      const ko = raw.indexOf("ko");
      const en = raw.indexOf("en");
      if (ko !== -1 && (en === -1 || ko <= en)) language = "ko";
      else if (en !== -1) language = "en";
      else {
        errors.push(
          `${label}「${term}」: "language" は "en" か "ko" にしてください`,
        );
        return;
      }
    }

    const kind = detectKind(r.kind, d.kind);
    const folder_id = resolveFolder(r.folder ?? r.folder_id, d.folderId, d.folders);

    valid.push({
      term,
      language,
      kind,
      folder_id,
      reading: optStr(r.reading),
      part_of_speech: optStr(r.part_of_speech),
      meaning,
      example: optStr(r.example),
      example_translation: optStr(r.example_translation),
      notes: optStr(r.notes),
    });
  });

  return { valid, errors };
}

export default function ImportPage() {
  const [defaultLang, setDefaultLang] = useState<Language>("en");
  const [defaultKind, setDefaultKind] = useState<Kind>("word");
  const [defaultFolderId, setDefaultFolderId] = useState<string>("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setFolders((data as Folder[]) ?? []));
  }, []);

  const result = useMemo(
    () =>
      parseInput(text, {
        language: defaultLang,
        kind: defaultKind,
        folderId: defaultFolderId,
        folders,
      }),
    [text, defaultLang, defaultKind, defaultFolderId, folders],
  );

  async function handleCopyTemplate() {
    try {
      await navigator.clipboard.writeText(TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setText(TEMPLATE);
    }
  }

  async function handleImport() {
    if (result.valid.length === 0) return;
    setError("");
    setSavedCount(null);
    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("words")
      .insert(result.valid);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSavedCount(result.valid.length);
    setText("");
  }

  const hasInput = text.trim() !== "";

  return (
    <div className="flex animate-rise flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">JSONで一括追加</h1>
        <Link
          href="/add"
          className="text-sm font-semibold text-indigo-600 underline"
        >
          1語ずつ追加
        </Link>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">テンプレート</h2>
        <p className="text-xs leading-relaxed text-gray-500">
          下の形式の JSON 配列を貼り付けてください。
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            term
          </code>
          と
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            meaning
          </code>
          は必須、他は任意です。
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            kind
          </code>
          は <code>word</code> / <code>idiom</code>、
          <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px]">
            folder
          </code>
          はフォルダ名で指定できます（省略時は下のデフォルトを使用）。
        </p>

        <pre className="max-h-56 overflow-auto rounded-xl bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
          {TEMPLATE}
        </pre>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyTemplate}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition active:scale-[0.97]"
          >
            {copied ? "コピーしました" : "テンプレートをコピー"}
          </button>
          <a
            href="/word-template.json"
            download="word-template.json"
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition active:scale-[0.97]"
          >
            ファイルを保存
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">デフォルト（省略時に適用）</h2>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">言語</span>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
            {(["en", "ko"] as Language[]).map((lang) => {
              const active = defaultLang === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setDefaultLang(lang)}
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
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">区分</span>
          <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold">
            {(["word", "idiom"] as Kind[]).map((k) => {
              const active = defaultKind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDefaultKind(k)}
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
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-500">フォルダ</span>
          <select
            value={defaultFolderId}
            onChange={(e) => setDefaultFolderId(e.target.value)}
            className={FIELD}
          >
            <option value="">フォルダなし</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700">JSON を貼り付け</h2>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSavedCount(null);
            setError("");
          }}
          rows={20}
          spellCheck={false}
          placeholder='[ { "term": "...", "meaning": "..." } ]'
          className={`${FIELD} min-h-[70dvh] resize-y font-mono text-[13px] leading-relaxed`}
        />

        {hasInput && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-emerald-600">
              追加できる: {result.valid.length} 件
            </span>
            {result.errors.length > 0 && (
              <span className="font-semibold text-red-500">
                エラー: {result.errors.length} 件
              </span>
            )}
          </div>
        )}

        {result.errors.length > 0 && (
          <ul className="flex max-h-40 flex-col gap-1 overflow-auto rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
            {result.errors.map((msg, i) => (
              <li key={i}>・{msg}</li>
            ))}
          </ul>
        )}
      </section>

      {result.valid.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700">
            プレビュー（{result.valid.length} 件）
          </h2>
          <ul className="flex max-h-72 flex-col divide-y divide-gray-100 overflow-auto">
            {result.valid.map((w, i) => {
              const meta = LANGUAGE_META[w.language];
              const kindMeta = KIND_META[w.kind];
              const folderName = w.folder_id
                ? folders.find((f) => f.id === w.folder_id)?.name
                : null;
              return (
                <li key={i} className="flex items-start gap-2.5 py-2">
                  <span
                    className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                  >
                    {meta.code}
                  </span>
                  <span
                    className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kindMeta.badgeClass}`}
                  >
                    {kindMeta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w.term}</p>
                    <p className="truncate text-xs text-gray-500">
                      {w.meaning}
                    </p>
                    {folderName && (
                      <p className="truncate text-[10px] text-indigo-500">
                        📁 {folderName}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      )}
      {savedCount !== null && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <span>{savedCount} 件を追加しました</span>
          <Link href="/words" className="font-semibold underline">
            一覧で見る
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={saving || result.valid.length === 0}
        className="rounded-xl bg-indigo-600 py-3.5 font-semibold text-white shadow-sm shadow-indigo-500/25 transition active:scale-[0.99] disabled:opacity-40"
      >
        {saving
          ? "追加中…"
          : result.valid.length > 0
            ? `${result.valid.length} 件を追加する`
            : "JSON を貼り付けてください"}
      </button>
    </div>
  );
}
