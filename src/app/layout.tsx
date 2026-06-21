import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Wordtock ─ 単語ストック",
  description: "知らない英語・韓国語の単語をためて、間隔反復で復習する単語帳アプリ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wordtock",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-dvh">
        <ServiceWorkerRegister />
        <main className="mx-auto w-full max-w-md px-4 pt-6 pb-28">
          {children}
        </main>
        <NavBar />
      </body>
    </html>
  );
}
