import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・PWA ファイル・API を除く全ルートで認証を確認する
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|api/).*)",
  ],
};
