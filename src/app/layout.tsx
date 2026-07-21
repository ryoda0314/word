import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Wordtock ─ 単語ストック",
  description: "知らない英語・韓国語の単語をためて、間隔反復で復習する単語帳アプリ",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // viewport-fit:cover と合わせ、ステータスバー下までコンテンツを広げる
    statusBarStyle: "black-translucent",
    title: "Wordtock",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // iPhone のセーフエリア（ノッチ・ホームインジケーター）まで画面を広げ、
  // env(safe-area-inset-*) を有効にする
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <ServiceWorkerRegister />
        {/* 上はノッチ/ステータスバー、下はナビ + ホームインジケーターのぶんを確保 */}
        <main className="mx-auto w-full max-w-md px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <NavBar />
      </body>
    </html>
  );
}
