"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-500 transition active:scale-[0.99] disabled:opacity-50"
    >
      {loading ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
