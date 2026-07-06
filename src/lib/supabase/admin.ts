import { createClient } from "@supabase/supabase-js";

// service_role を使う管理用クライアント（サーバー限定・RLS バイパス）。
// ScienceTokyo SSO のブリッジ（ユーザー作成 / マジックリンク発行）に使う。
// 絶対にクライアントへ渡さないこと。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase admin env vars are not set (SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
