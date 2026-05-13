"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, User, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Person = {
  id:        string;
  email:     string;
  full_name: string | null;
  role:      string;
};

export function AssignClientModal({
  open, onClose, onConfirm, busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (target: Person, activate: boolean) => Promise<void> | void;
  busy: boolean;
}) {
  const [people,    setPeople]    = useState<Person[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [query,     setQuery]     = useState("");
  const [selected,  setSelected]  = useState<Person | null>(null);
  const [activate,  setActivate]  = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res  = await fetch("/api/admin/users", { cache: "no-store" });
        const data = await res.json() as { users?: Person[]; error?: string };
        if (cancelled) return;
        if (!res.ok || data.error) {
          setError(data.error ?? "Failed to load users");
        } else {
          setPeople(data.users ?? []);
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people.slice(0, 50);
    return people.filter((p) => {
      return p.email.toLowerCase().includes(q)
        || (p.full_name ?? "").toLowerCase().includes(q);
    }).slice(0, 50);
  }, [people, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#111] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35 mb-1">Send workout</p>
            <h2 className="text-base font-semibold text-white/90">Choose a recipient</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/40" strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={2} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="w-full bg-white/[0.03] border border-white/8 rounded-xl pl-9 pr-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="px-5 py-3 max-h-[40vh] overflow-y-auto">
          {loading ? (
            <div className="py-8 flex items-center justify-center text-white/40">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading users…
            </div>
          ) : error ? (
            <p className="text-xs text-red-400/80 text-center py-6">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">No matches</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => {
                const isSel = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
                      isSel
                        ? "border-[#B48B40]/40 bg-[#B48B40]/8"
                        : "border-transparent hover:border-white/8 hover:bg-white/[0.025]",
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      isSel ? "bg-[#B48B40]/20" : "bg-white/[0.04]",
                    )}>
                      {isSel
                        ? <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />
                        : <User className="w-3.5 h-3.5 text-white/45" strokeWidth={1.8} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/85 truncate">
                        {p.full_name?.trim() || p.email.split("@")[0]}
                      </p>
                      <p className="text-[11px] text-white/35 truncate">{p.email} · {p.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Activate toggle */}
        <div className="px-5 pb-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-2">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
              className="w-4 h-4 rounded border-white/15 bg-white/[0.04] accent-[#B48B40]"
            />
            <span className="text-xs text-white/65">Set as their active program</span>
          </label>
          <p className="text-[10px] text-white/30 leading-relaxed">
            On — archives their current active program. Off — saved as a template they can activate later.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06] bg-white/[0.015]">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm text-white/55 hover:text-white/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && void onConfirm(selected, activate)}
            disabled={!selected || busy}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2",
              selected && !busy
                ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                : "bg-white/[0.05] text-white/30 cursor-not-allowed",
            )}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {busy ? "Sending…" : "Send workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
