"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Notif = {
  id: string; type: string; title: string; body: string | null;
  link: string | null; actor_name: string | null; read_at: string | null; created_at: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { notifications: [], unread: 0 }))
      .then((j) => { setItems(j.notifications ?? []); setUnread(j.unread ?? 0); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    function onVis() { if (document.visibilityState === "visible") load(); }
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(load, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.clearInterval(t); };
  }, [load]);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function openItem(n: Notif) {
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      fetch("/api/notifications", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.link) { setOpen(false); router.push(n.link); }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        className="fs-topbar-icon-button relative flex items-center justify-center w-8 h-8 rounded-full border border-transparent text-white/55 hover:text-white/85 hover:bg-white/[0.05] transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" strokeWidth={1.7} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B48B40] text-black text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fs-shell-menu absolute right-0 top-full mt-2 w-80 max-w-[88vw] rounded-2xl border border-white/8 bg-[#111111] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <p className="text-xs font-semibold text-white/75">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[10px] text-[#B48B40]/80 hover:text-[#B48B40] inline-flex items-center gap-1">
                <Check className="w-3 h-3" strokeWidth={2} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-xs text-white/30 px-4 py-8 text-center">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors flex gap-2.5",
                    !n.read_at && "bg-[#B48B40]/[0.04]",
                  )}
                >
                  <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", n.read_at ? "bg-transparent" : "bg-[#B48B40]")} />
                  <div className="min-w-0">
                    <p className="text-sm text-white/85 font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{n.body}</p>}
                    <p className="text-[10px] text-white/25 mt-1">
                      {n.actor_name ? `${n.actor_name} · ` : ""}
                      {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
