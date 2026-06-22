import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LANG_NAME: Record<string, string> = {
  en: "英語",
  ko: "韓国語",
};

type WordRow = {
  id: string;
  term: string;
  language: "en" | "ko";
  meaning: string;
  kind: "word" | "idiom" | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: {
    folderId?: string;
    wordIds?: unknown;
    language?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です" },
      { status: 400 },
    );
  }

  const wordIds = Array.isArray(body.wordIds)
    ? body.wordIds.filter((x): x is string => typeof x === "string")
    : [];
  const requestedLang =
    body.language === "en" || body.language === "ko" ? body.language : null;

  if (wordIds.length === 0) {
    return NextResponse.json(
      { error: "使う単語を選択してください" },
      { status: 400 },
    );
  }

  // プロンプトが膨らみすぎないように上限。これ以上は精度も落ちる
  const limitedIds = wordIds.slice(0, 25);

  // 指定された ID の単語だけを取得（RLS により自分の単語に限定される）
  const { data: words, error: fetchError } = await supabase
    .from("words")
    .select("id, term, language, meaning, kind")
    .in("id", limitedIds);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!words || words.length === 0) {
    return NextResponse.json(
      { error: "指定された単語が見つかりませんでした" },
      { status: 400 },
    );
  }

  const allRows = words as WordRow[];

  // 言語を決める（指定があればそれ、無ければ選択した単語の多数派）
  const counts = allRows.reduce<Record<string, number>>((acc, w) => {
    acc[w.language] = (acc[w.language] ?? 0) + 1;
    return acc;
  }, {});
  const language: "en" | "ko" =
    requestedLang ?? ((counts.ko ?? 0) > (counts.en ?? 0) ? "ko" : "en");

  // 同じ言語の語だけを最終ターゲットにする
  const targets = allRows.filter((w) => w.language === language);
  if (targets.length === 0) {
    return NextResponse.json(
      { error: `選んだ単語に${LANG_NAME[language]}が含まれていません` },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "placeholder-openai-key") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 500 },
    );
  }

  const langName = LANG_NAME[language];
  const wordsList = targets
    .map(
      (w, i) =>
        `${i + 1}. id=${w.id} / 表記=「${w.term}」/ 意味=${w.meaning}`,
    )
    .join("\n");

  // GPTには、対象単語を文中で使った箇所を <w id="..."> タグで囲ませる。
  // 活用形・助詞付きの形も自然に使ってOK（タグ内のテキストがそのまま表示される）。
  const prompt = `次の${langName}の単語リストをできるだけ多く自然に使った、3〜5文の${langName}の短い文章を1つ作ってください。日記・会話・カフェの一場面・SNSの投稿など、実際にありそうな実践的な内容にしてください。

【ルール】
- 出力は JSON オブジェクトのみ。前後に説明・コードブロックを付けない。
- ${langName}として自然な活用形に変えてよい（韓国語なら助詞や語尾の変化、英語なら時制や活用など）。
- 単語リストの語が出現する箇所は、必ず <w id="ID">表記</w> の形式のタグで囲む。
- 【厳守】タグの開始は <w から始まる（< と w の間にスペースを入れない）。閉じは </w>（< と / と w の間にスペースを入れない）。
- 【厳守】id 属性は必ずダブルクォート " で囲む。シングルクォートや囲み無しは禁止。
- 【厳守】タグ内の表記には改行を含めない。文の途中でも 1 つの <w>...</w> の中で完結させる。
- 同じ単語が複数回出るなら、すべての出現箇所をタグで囲む。
- リストに無い語にはタグを付けない。
- できるだけリストの全単語を使うこと（不自然になる場合は省略可）。

【単語リスト】
${wordsList}

【良い例】
<w id="abc">갔어요</w>

【悪い例（絶対にやらない）】
< w id="abc">갔어요</w>   ← <とwの間にスペース
<w id='abc'>갔어요</w>     ← シングルクォート
<w id=abc>갔어요</w>       ← 引用符なし
< w id ="abc" >갔어요< /w > ← 余計なスペース

【出力 JSON】
{
  "passage": "<w id=\\"abc\\">語</w> を含む${langName}の文章",
  "translation": "上の文章の自然な日本語訳",
  "used_ids": ["実際に文中で使った単語の id を配列で"]
}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      messages: [
        {
          role: "system",
          content:
            "あなたは自然な文章を作る語学講師です。必ず有効な JSON のみを返します。",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const passage = typeof parsed.passage === "string" ? parsed.passage : "";
    const translation =
      typeof parsed.translation === "string" ? parsed.translation : "";
    const usedRaw = Array.isArray(parsed.used_ids) ? parsed.used_ids : [];
    const usedIds = usedRaw.filter((x): x is string => typeof x === "string");

    // クライアントに渡す単語辞書（タップ時のポップアップに使う）
    const wordsMap: Record<string, { term: string; meaning: string }> = {};
    for (const w of targets) {
      wordsMap[w.id] = { term: w.term, meaning: w.meaning };
    }

    return NextResponse.json({
      passage,
      translation,
      language,
      usedIds,
      words: wordsMap,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
