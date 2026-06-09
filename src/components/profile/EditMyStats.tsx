"use client";

// Fix-a-mistake editor for the core onboarding stats (age, sex, height, weight,
// goal weight, activity, goal) — the ones that drive your calorie/macro numbers.
// Edits write to your own raw_answers via /api/me/intake (scoped to user.id) and
// update the local cache so nutrition recalculates immediately.

import { useState, useEffect } from "react";
import { Pencil, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { getOnboardingState } from "@/lib/db/onboarding";
import { loadIntake, saveIntake } from "@/lib/data/intake";
import {
  readStoredUnitSystem, weightUnitLabel, kgToDisplayUnit, displayUnitToKg, type UnitSystem,
} from "@/lib/units";

const ACTIVITY: { v: string; l: string }[] = [
  { v: "sedentary", l: "Sedentary" }, { v: "light", l: "Light" }, { v: "moderate", l: "Moderate" },
  { v: "very_active", l: "Very active" }, { v: "athlete", l: "Athlete" },
];
const GOALS: { v: string; l: string }[] = [
  { v: "muscle_gain", l: "Build muscle" }, { v: "fat_loss", l: "Lose fat" }, { v: "strength", l: "Get stronger" },
  { v: "recomp", l: "Recomp" }, { v: "endurance", l: "Endurance" }, { v: "general", l: "General" },
];
const num = (v: unknown) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) && n > 0 ? n : null; };

export function EditMyStats() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sys, setSys] = useState<UnitSystem>("metric");

  // form fields
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [cm, setCm] = useState("");          // metric height
  const [ft, setFt] = useState(""); const [inch, setInch] = useState(""); // imperial height
  const [weight, setWeight] = useState("");  // display unit
  const [goalW, setGoalW] = useState("");    // display unit
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");

  const isRealUser = !!user?.id && /^[0-9a-f-]{36}$/i.test(user.id) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (!isRealUser) { setLoaded(true); return; }
    const s = readStoredUnitSystem(user.id) ?? "metric";
    setSys(s);
    let active = true;
    getOnboardingState(user.id).then((st) => {
      if (!active) return;
      const raw = (st?.raw_answers ?? {}) as Record<string, unknown>;
      const deep = (raw.deep ?? {}) as Record<string, unknown>;
      setAge(typeof raw.age === "string" ? raw.age : "");
      setSex(raw.sex === "male" || raw.sex === "female" ? raw.sex : "");
      setActivity(typeof raw.activityLevel === "string" ? raw.activityLevel : "");
      setGoal(typeof raw.primaryGoal === "string" ? raw.primaryGoal : "");
      // height → cm
      let heightCm = num(deep.heightCm);
      if (!heightCm && raw.height) heightCm = raw.heightUnit === "ft" ? Math.round((num(raw.height) ?? 0) * 30.48) : num(raw.height);
      if (heightCm) {
        if (s === "imperial") { const totalIn = heightCm / 2.54; setFt(String(Math.floor(totalIn / 12))); setInch(String(Math.round(totalIn % 12))); }
        else setCm(String(Math.round(heightCm)));
      }
      // weight → display unit
      let wKg = num(deep.weightKg);
      if (!wKg && raw.weight) wKg = raw.weightUnit === "lbs" ? (num(raw.weight) ?? 0) * 0.4536 : num(raw.weight);
      if (wKg) setWeight(String(Math.round(kgToDisplayUnit(wKg, s) * 10) / 10));
      const gKg = num(deep.goalWeightKg);
      if (gKg) setGoalW(String(Math.round(kgToDisplayUnit(gKg, s) * 10) / 10));
    }).catch(() => {}).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [user?.id, isRealUser]);

  async function save() {
    if (saving) return;
    setSaving(true); setSaved(false);
    // height → cm
    const heightCm = sys === "imperial"
      ? Math.round(((num(ft) ?? 0) * 12 + (num(inch) ?? 0)) * 2.54)
      : (num(cm) ?? 0);
    const wUnit = sys === "imperial" ? "lbs" : "kg";
    const body: Record<string, unknown> = {
      age, sex, activityLevel: activity, primaryGoal: goal,
    };
    if (num(weight)) { body.weight = num(weight); body.weightUnit = wUnit; }
    if (heightCm > 0) { body.height = heightCm; body.heightUnit = "cm"; }
    if (num(goalW)) body.goalWeightKg = Math.round(displayUnitToKg(num(goalW)!, sys) * 10) / 10;

    try {
      const res = await fetch("/api/me/intake", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        // keep the local cache in sync so nutrition recalcs right away
        try {
          const intake = loadIntake(user.id);
          if (intake) saveIntake(user.id, { ...intake, age, sex: (sex || undefined) as never, activityLevel: (activity || undefined) as never, primaryGoal: goal, weight: num(weight) ? String(num(weight)) : intake.weight, weightUnit: wUnit, height: heightCm > 0 ? String(heightCm) : intake.height, heightUnit: "cm" } as typeof intake);
        } catch { /* ignore */ }
        setSaved(true);
        setTimeout(() => setOpen(false), 900);
      }
    } finally { setSaving(false); }
  }

  if (!loaded || !isRealUser) return null;

  const field = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/85 outline-none focus:border-[#B48B40]/40";
  const chip = (on: boolean) => cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", on ? "border-[#B48B40]/45 bg-[#B48B40]/12 text-[#B48B40]" : "border-white/10 text-white/55 hover:text-white/80");

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="text-sm font-semibold text-white/85 flex items-center gap-2"><Pencil className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Edit your stats</span>
        <span className="text-[11px] text-white/35">{open ? "Close" : "Fix age, height, weight, goal…"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 block">Age</label>
              <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={field} placeholder="30" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 block">Sex</label>
              <div className="flex gap-2">
                {(["male", "female"] as const).map((s) => (
                  <button key={s} onClick={() => setSex(sex === s ? "" : s)} className={cn(chip(sex === s), "flex-1 capitalize")}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 block">Height</label>
            {sys === "imperial" ? (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1"><input type="number" inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} className={field} placeholder="5" /><span className="text-[11px] text-white/30">ft</span></div>
                <div className="flex-1 flex items-center gap-1"><input type="number" inputMode="numeric" value={inch} onChange={(e) => setInch(e.target.value)} className={field} placeholder="10" /><span className="text-[11px] text-white/30">in</span></div>
              </div>
            ) : (
              <div className="flex items-center gap-1"><input type="number" inputMode="numeric" value={cm} onChange={(e) => setCm(e.target.value)} className={field} placeholder="178" /><span className="text-[11px] text-white/30">cm</span></div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 block">Current weight ({weightUnitLabel(sys)})</label>
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={field} placeholder="180" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 block">Goal weight ({weightUnitLabel(sys)})</label>
              <input type="number" inputMode="decimal" value={goalW} onChange={(e) => setGoalW(e.target.value)} className={field} placeholder="170" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5 block">Activity level</label>
            <div className="flex flex-wrap gap-2">{ACTIVITY.map((a) => <button key={a.v} onClick={() => setActivity(a.v)} className={chip(activity === a.v)}>{a.l}</button>)}</div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1.5 block">Goal</label>
            <div className="flex flex-wrap gap-2">{GOALS.map((g) => <button key={g.v} onClick={() => setGoal(g.v)} className={chip(goal === g.v)}>{g.l}</button>)}</div>
          </div>

          <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-xl bg-[#B48B40] text-black text-sm font-semibold hover:bg-[#c99840] disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : null}
            {saved ? "Saved — numbers updated" : saving ? "Saving…" : "Save changes"}
          </button>
          <p className="text-[10px] text-white/30 text-center">These feed your calorie &amp; macro targets — only your account.</p>
        </div>
      )}
    </div>
  );
}
