import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { SCIENCETOKYO_URL, SSO_STATE_COOKIE, ssoEmailFor } from "@/lib/sciencetokyo";

// GET /auth/callback?code=&state=&error=
// ScienceTokyo authorize からの戻り。code を token エンドポイントで検証し、
// 得た identity をこの Supabase プロジェクトのセッションに橋渡しする。
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const ssoError = params.get("error");

  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/login?sso_error=${encodeURIComponent(reason)}`, 302);
    res.cookies.delete(SSO_STATE_COOKIE);
    return res;
  };

  // CSRF: ボタン経由(/auth/sciencetokyo)のときは state クッキーと一致必須。
  // マイアプリからのハンドオフ(同一オリジンで発行した code を直接受領)のときは
  // state クッキーが無いので、その場合は検証をスキップする。
  const savedState = request.cookies.get(SSO_STATE_COOKIE)?.value;
  if (savedState && (!state || state !== savedState)) return fail("state_mismatch");
  if (ssoError) return fail(ssoError);
  if (!code) return fail("no_code");

  const secret = process.env.SCIENCETOKYO_SSO_SECRET;
  if (!secret) return fail("not_configured");

  // 1) code → ユーザー情報（サーバー間でのみ client_secret を送る）
  let user: { id: string; name?: string };
  try {
    const r = await fetch(new URL("/api/sso/token", SCIENCETOKYO_URL).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, client_secret: secret, redirect_uri: `${origin}/auth/callback` }),
    });
    if (!r.ok) return fail("exchange_failed");
    const data = await r.json();
    if (!data?.user?.id) return fail("exchange_failed");
    user = data.user;
  } catch {
    return fail("exchange_failed");
  }

  // 成功時のレスポンスを先に作り、Supabase のセッションクッキーはここに直接書く
  const res = NextResponse.redirect(`${origin}/`, 302);
  res.cookies.delete(SSO_STATE_COOKIE);

  // 2) identity → Supabase セッションへ橋渡し
  try {
    const email = ssoEmailFor(user.id);
    const admin = createAdminClient();

    // ユーザーを用意（既存ならエラーは無視）
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { provider: "sciencetokyo", st_id: user.id, name: user.name || "" },
    });

    // マジックリンクの token_hash を発行し、サーバー側で検証してセッション確立
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) return fail("session_failed");

    // セッションクッキーを res へ書き込むクライアント
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              res.cookies.set(name, value, options);
            }
          },
        },
      },
    );
    const { error: otpErr } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (otpErr) return fail("session_failed");
  } catch {
    return fail("session_failed");
  }

  return res;
}
