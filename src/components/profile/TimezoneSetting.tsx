"use client";

// Timezone picker for Profile settings. Auto-detected on first app open; this
// lets the user confirm/override it. Scheduled reminders are stored as absolute
// instants and shown in each person's local zone.

import { useState, useEffect } from "react";

const COMMON: { value: string; label: string }[] = [
  { value: "America/New_York",    label: "Eastern (New York)" },
  { value: "America/Chicago",     label: "Central (Chicago)" },
  { value: "America/Denver",      label: "Mountain (Denver)" },
  { value: "America/Phoenix",     label: "Arizona (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage",   label: "Alaska" },
  { value: "Pacific/Honolulu",    label: "Hawaii" },
  { value: "America/Toronto",     label: "Toronto" },
  { value: "Europe/London",       label: "London" },
  { value: "Europe/Paris",        label: "Central Europe (Paris)" },
  { value: "Australia/Sydney",    label: "Sydney" },
];

export function TimezoneSetting() {
  const detected = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "America/New_York"; } })();
  const [value, setValue] = useState<string>(detected);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me/timezone", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (typeof j?.timezone === "string" && j.timezone) setValue(j.timezone); })
      .catch(() => {});
  }, []);

  function save(tz: string) {
    setValue(tz);
    setSaving(true);
    fetch("/api/me/timezone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone: tz }) })
      .catch(() => {})
      .finally(() => setSaving(false));
  }

  // Make sure the current + detected zones are always selectable.
  const options = [...COMMON];
  for (const z of [value, detected]) {
    if (z && !options.some((o) => o.value === z)) options.unshift({ value: z, label: z.replace(/_/g, " ") });
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25 disabled:opacity-50 cursor-pointer max-w-[15rem]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
