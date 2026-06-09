"use client";

// "Where you train" analytics — a radar/web diagram of working-set distribution
// across muscle groups, plus headline volume stats. Self-contained: pulls the
// user's workout logs + their weight-unit preference. Volume shown in lb/kg per
// the profile. Pure SVG, no chart lib.

import { useEffect, useMemo, useState } from "react";
import { Dumbbell, TrendingUp, Layers, Trophy } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getWorkoutLogsForUser, type WorkoutLog } from "@/lib/workout";
import { readStoredUnitSystem, kgToDisplayUnit, weightUnitLabel, type UnitSystem } from "@/lib/units";

const GROUPS = ["Chest", "Back", "Shoulders", "Quads", "Posterior", "Arms", "Core"] as const;
type Group = typeof GROUPS[number];

// Classify an exercise name → muscle group. Order matters (leg/shoulder press
// before bench press; rdl/curl variants before generic).
function classify(nameRaw: string): Group | null {
  const n = nameRaw.toLowerCase();
  if (/calf|leg press|squat|lunge|leg extension|step.?up|hack/.test(n)) return "Quads";
  if (/rdl|romanian|deadlift|hamstring|leg curl|hip thrust|glute|good morning/.test(n)) return "Posterior";
  if (/lateral raise|overhead|shoulder press|\bohp\b|arnold|delt|rear delt|upright row/.test(n)) return "Shoulders";
  if (/bench|chest|push.?up|\bfly\b|\bdip\b|pec/.test(n)) return "Chest";
  if (/row|pulldown|pull.?up|chin.?up|\blat\b|shrug|face pull/.test(n)) return "Back";
  if (/curl|tricep|pushdown|skull|\bbicep|extension|preacher/.test(n)) return "Arms";
  if (/plank|crunch|\bab\b|abs|core|sit.?up|leg raise|hollow|rotation/.test(n)) return "Core";
  if (/press/.test(n)) return "Chest"; // generic press → chest
  return null;
}

export function WorkoutMuscleRadar() {
  const { user } = useUser();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [unit, setUnit] = useState<UnitSystem>("metric");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setUnit(readStoredUnitSystem(user.id) ?? "metric");
    let active = true;
    getWorkoutLogsForUser(user.id)
      .then((l) => { if (active) setLogs(l); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [user?.id]);

  const stats = useMemo(() => {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000; // last 60 days
    const setsByGroup: Record<Group, number> = { Chest: 0, Back: 0, Shoulders: 0, Quads: 0, Posterior: 0, Arms: 0, Core: 0 };
    let totalSets = 0, totalVolumeKg = 0, sessions = 0;
    for (const log of logs) {
      if ((log.completedAt ?? 0) < cutoff) continue;
      sessions++;
      for (const ex of log.exercises ?? []) {
        const g = classify(ex.name || "");
        for (const s of ex.setLogs ?? []) {
          if (!s.completed) continue;
          totalSets++;
          if (g) setsByGroup[g]++;
          const reps = parseFloat(String(s.completedReps)) || 0;
          const load = parseFloat(String(s.completedLoad)) || 0;
          totalVolumeKg += reps * load;
        }
      }
    }
    const max = Math.max(1, ...GROUPS.map((g) => setsByGroup[g]));
    const top = GROUPS.reduce((a, g) => (setsByGroup[g] > setsByGroup[a] ? g : a), "Chest" as Group);
    return { setsByGroup, totalSets, totalVolumeKg, sessions, max, top };
  }, [logs]);

  // Radar geometry
  const size = 260, cx = size / 2, cy = size / 2, R = 96;
  const pts = GROUPS.map((g, i) => {
    const ang = (Math.PI * 2 * i) / GROUPS.length - Math.PI / 2;
    const r = (stats.setsByGroup[g] / stats.max) * R;
    return {
      g, ang,
      x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r,
      ax: cx + Math.cos(ang) * R, ay: cy + Math.sin(ang) * R,
      lx: cx + Math.cos(ang) * (R + 20), ly: cy + Math.sin(ang) * (R + 20),
    };
  });
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];

  const volDisplay = Math.round(kgToDisplayUnit(stats.totalVolumeKg, unit)).toLocaleString();
  const unitLabel = weightUnitLabel(unit);

  if (loaded && stats.totalSets === 0) return null; // nothing logged yet

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40 flex items-center gap-1.5 mb-4">
        <Dumbbell className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={1.8} /> Training map · last 60 days
      </p>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Radar */}
        <svg viewBox={`0 0 ${size} ${size}`} className="w-[260px] h-[260px] shrink-0">
          {rings.map((f, i) => (
            <polygon key={i}
              points={GROUPS.map((_, j) => {
                const a = (Math.PI * 2 * j) / GROUPS.length - Math.PI / 2;
                return `${(cx + Math.cos(a) * R * f).toFixed(1)},${(cy + Math.sin(a) * R * f).toFixed(1)}`;
              }).join(" ")}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {pts.map((p) => <line key={p.g} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />)}
          <polygon points={poly} fill="rgba(180,139,64,0.22)" stroke="#B48B40" strokeWidth={2} strokeLinejoin="round" />
          {pts.map((p) => <circle key={p.g} cx={p.x} cy={p.y} r={3} fill="#B48B40" />)}
          {pts.map((p) => (
            <text key={p.g} x={p.lx} y={p.ly}
              textAnchor={Math.abs(p.lx - cx) < 8 ? "middle" : p.lx > cx ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-white/45 text-[10px]">{p.g}</text>
          ))}
        </svg>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {[
            { icon: TrendingUp, label: "Volume lifted", value: `${volDisplay} ${unitLabel}`, sub: "reps × load" },
            { icon: Layers,     label: "Working sets",  value: String(stats.totalSets), sub: `${stats.sessions} sessions` },
            { icon: Trophy,     label: "Most trained",  value: stats.top, sub: `${stats.setsByGroup[stats.top]} sets` },
            { icon: Dumbbell,   label: "Groups hit",    value: `${GROUPS.filter((g) => stats.setsByGroup[g] > 0).length}/7`, sub: "balance" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 flex items-center gap-1.5"><Icon className="w-3 h-3 text-[#B48B40]/70" strokeWidth={1.8} /> {label}</p>
              <p className="text-lg font-bold text-white/90 mt-1 tabular-nums leading-none">{value}</p>
              <p className="text-[10px] text-white/35 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
