"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const homeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

const listIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

const addIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const reviewIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);

const folderIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const memoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M4 4h16v12H8l-4 4z" />
    <path d="M8 9h8M8 12h5" />
  </svg>
);

const items = [
  { href: "/", label: "ホーム", icon: homeIcon },
  { href: "/words", label: "一覧", icon: listIcon },
  { href: "/add", label: "追加", icon: addIcon },
  { href: "/folders", label: "フォルダ", icon: folderIcon },
  { href: "/memo", label: "メモ", icon: memoIcon },
  { href: "/review", label: "復習", icon: reviewIcon },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-md items-stretch justify-around px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)]">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span
                className={`flex h-9 w-12 items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                    : "text-gray-400"
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[11px] font-semibold transition-colors ${
                  active ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
