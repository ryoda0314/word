// ScienceTokyo App の SSO 連携設定。
// 「ScienceTokyoでログイン」= ScienceTokyo 側の OAuth 風フローで得た identity を
// この Supabase プロジェクトのユーザーに橋渡しする。

export const SCIENCETOKYO_URL =
  process.env.SCIENCETOKYO_URL || "https://sciencetokyo.app";

export const SSO_STATE_COOKIE = "st_sso_state";

/** ScienceTokyo ユーザー id → この Supabase の決定論的メールアドレス。 */
export function ssoEmailFor(userId: string): string {
  return `st.${String(userId).replace(/[^a-zA-Z0-9_.-]/g, "")}@sso.sciencetokyo.app`;
}
