import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LANG_NAME: Record<string, string> = {
  en: "英語",
  ko: "韓国語",
};

export async function POST(request: Request) {
  // ログインユーザーのみ利用可能
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { term?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です" },
      { status: 400 },
    );
  }

  const term = (body.term ?? "").trim();
  const language = body.language === "ko" ? "ko" : "en";
  if (!term) {
    return NextResponse.json(
      { error: "単語を入力してください" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "placeholder-openai-key") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません（.env.local を確認してください）" },
      { status: 500 },
    );
  }

  const langName = LANG_NAME[language];
  const readingHint =
    language === "en"
      ? "発音記号（IPA）"
      : "ハングルの読み（カタカナ）とローマ字表記";

  const prompt = `あなたは${langName}を学ぶ日本語話者向けの辞書です。次の${langName}の単語・表現について調べ、JSONオブジェクトのみを出力してください（前後に説明文やコードブロック記号を付けないこと）。

調べる単語: ${term}

出力するJSONのキー:
{
  "term": "正規化・スペル修正した見出し語",
  "reading": "${readingHint}",
  "part_of_speech": "品詞（日本語。例: 名詞 / 動詞 / 形容詞 / 副詞 / 表現）",
  "meaning": "日本語での意味。簡潔に。複数の意味がある場合は「①…／②…」のようにまとめる",
  "example": "${langName}での自然な例文を1つ",
  "example_translation": "その例文の日本語訳"
}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      messages: [
        {
          role: "system",
          content:
            "あなたは正確な語学辞書アシスタントです。必ず有効なJSONのみを返します。",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const str = (v: unknown) => (typeof v === "string" ? v : "");

    return NextResponse.json({
      term: str(parsed.term) || term,
      reading: str(parsed.reading),
      part_of_speech: str(parsed.part_of_speech),
      meaning: str(parsed.meaning),
      example: str(parsed.example),
      example_translation: str(parsed.example_translation),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
