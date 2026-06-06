"use client";

// Tracks unseen coach-assigned tasks for the signed-in user so the
// Accountability nav item can highlight "new". Polls lightly; clears on open.

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type Ctx = { unseen: number; refresh: () => void; markSeen: () => void };

const TasksBadgeContext = createContext<Ctx>({ unseen: 0, refresh: () => {}, markSeen: () => {} });

export function useTasksBadge() { return useContext(TasksBadgeContext); }

export function TasksBadgeProvider({ children }: { children: React.ReactNode }) {
  const [unseen, setUnseen] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/me/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setUnseen(typeof j?.unseen === "number" ? j.unseen : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  const markSeen = useCallback(() => {
    setUnseen(0);
    fetch("/api/me/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seen" }) }).catch(() => {});
  }, []);

  return <TasksBadgeContext.Provider value={{ unseen, refresh, markSeen }}>{children}</TasksBadgeContext.Provider>;
}
