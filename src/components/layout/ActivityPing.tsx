"use client";

// Fire-and-forget: records that the user opened the app (once per app load).
// Powers "how often they log in" (distinct active days) + last-seen on the
// coach's client file. No UI. Safe for demo users (server returns 401, ignored).

import { useEffect } from "react";

export function ActivityPing() {
  useEffect(() => {
    fetch("/api/me/ping", { method: "POST", keepalive: true }).catch(() => {});
  }, []);
  return null;
}
