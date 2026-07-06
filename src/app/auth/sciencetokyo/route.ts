import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { SCIENCETOKYO_URL, SSO_STATE_COOKIE } from "@/lib/sciencetokyo";

// GET /auth/sciencetokyo
// 「ScienceTokyoでログイン」の起点。CSRF 用 state を発行してクッキーに保存し、
// ScienceTokyo の authorize へリダイレクトする。
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/auth/callback`;
  const state = randomUUID();

  const authorize = new URL("/api/sso/authorize", SCIENCETOKYO_URL);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString(), 302);
  res.cookies.set(SSO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5分
  });
  return res;
}
