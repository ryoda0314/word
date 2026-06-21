"use client";

import { useEffect } from "react";

// 本番ビルドでのみ Service Worker を登録する（開発時のキャッシュ事故を防ぐ）
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 登録失敗は致命的でないため無視
    });
  }, []);

  return null;
}
