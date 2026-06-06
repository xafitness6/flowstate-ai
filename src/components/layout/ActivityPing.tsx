"use client";

// Fire-and-forget: records that the user opened the app (once per app load).
// Powers "how often they log in" (distinct active days) + last-seen on the
// coach's client file. No UI. Safe for demo users (server returns 401, ignored).

import { useEffect } from "react";

export function ActivityPing() {
  useEffect(() => {
    let tz: string | undefined;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
    fetch("/api/me/ping", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tz }),
    }).catch(() => {});
  }, []);
  return null;
}
