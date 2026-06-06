"use client";

// Nickname — the preferred name shown across the app (TopBar, coach/client
// chat, client lists). Falls back to your full name when blank.

import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import { useUser } from "@/context/UserContext";

export function NicknameSetting() {
  const { updateName } = useUser();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (typeof j?.nickname === "string") setValue(j.nickname); })
      .catch(() => {});
  }, []);

  function save() {
    if (saving) return;
    setSaving(true);
    fetch("/api/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: value.trim() }) })
      .then((r) => { if (r.ok && value.trim()) updateName(value.trim()); setSaved(true); setTimeout(() => setSaved(false), 1500); })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
        placeholder="Optional"
        maxLength={60}
        className="flex-1 sm:w-44 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-white/25"
      />
      <button onClick={save} disabled={saving} className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#B48B40] text-black px-3 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : null}
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
