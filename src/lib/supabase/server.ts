import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// サーバー（サーバーコンポーネント / Route Handler）用 Supabase クライアント
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // サーバーコンポーネントからの呼び出しでは set できない。
            // セッション更新は middleware が担当するため無視してよい。
          }
        },
      },
    },
  );
}
