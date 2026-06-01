"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Download, Loader2, Trash2, StickyNote, Send,
  User, Dumbbell, Apple, LineChart, MessageSquare,
  ExternalLink, CalendarDays, Clock, PlayCircle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IntakeReadout } from "@/components/intake/IntakeReadout";
import { PrefillPanel } from "@/components/intake/PrefillPanel";
import { useUser } from "@/context/UserContext";
import type { RawIntake } from "@/lib/intake/format";

type ClientProfile = {
  id: string; full_name: string | null; first_name: string | null; last_name: string | null;
  email: string | null; role: string; plan: string;
  assigned_trainer_id: string | null;
  assigned_trainer_name: string | null;
};
type Note = { id: string; body: string; author_name: string | null; created_at: string };
type IntakeMeta = {
  onboarding_complete: boolean | null;
  program_generated: boolean | null;
  completed_at: string | null;
} | null;
type ClientProgram = {
  id: string; block_name: string; goal: string;
  duration_weeks: number; weekly_training_days: number; session_length_target: number;
  body_focus_areas: string[] | null; equipment_profile: string[] | null;
  coaching_notes: string | null; status: string;
  start_date: string | null; end_date: string | null; created_at: string;
} | null;

type NutritionDay = { date: string; calories: number; protein: number; carbs: number; fat: number; meals: number };
type NutritionSummary = {
  days: NutritionDay[];
  today: NutritionDay | null;
  avg: { calories: number; protein: number; carbs: number; fat: number };
  daysLogged7: number;
  totalMeals14: number;
  recentMeals: { id: string; meal_type: string | null; label: string; calories: number; protein: number; needs_review: boolean; logged_at: string }[];
};

type TabKey = "overview" | "program" | "nutrition" | "progress" | "notes" | "chat";

const TABS: { key: TabKey; label: string; icon: typeof User; ready: boolean }[] = [
  { key: "overview",  label: "Overview",  icon: User,          ready: true  },
  { key: "program",   label: "Program",   icon: Dumbbell,      ready: true  },
  { key: "nutrition", label: "Nutrition", icon: Apple,         ready: false },
  { key: "progress",  label: "Progress",  icon: LineChart,     ready: false },
  { key: "notes",     label: "Notes",     icon: StickyNote,    ready: true  },
  { key: "chat",      label: "Chat",      icon: MessageSquare, ready: false },
];

/** Which training week the client is on, derived from the program's start date. */
function currentWeek(startDate: string | null, durationWeeks: number): number | null {
  if (!startDate) return null;
  const start = new Date(startDate).getTime();
  if (Number.isNaN(start)) return null;
  const elapsedWeeks = Math.floor((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, Math.min(durationWeeks, elapsedWeeks));
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: viewer } = useUser();
  const viewerIsAdmin = viewer.role === "master" || !!viewer.isAdmin;
  const id = params?.id as string;

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [intake,  setIntake]  = useState<RawIntake | null>(null);
  const [meta,    setMeta]    = useState<IntakeMeta>(null);
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [program, setProgram] = useState<ClientProgram>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<TabKey>("overview");

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [obBusy, setObBusy] = useState(false);

  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);

  const [trainerOptions, setTrainerOptions] = useState<{ value: string; label: string }[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [intakeRes, notesRes, programRes] = await Promise.all([
        fetch(`/api/clients/${id}/intake`,  { cache: "no-store" }),
        fetch(`/api/clients/${id}/notes`,   { cache: "no-store" }),
        fetch(`/api/clients/${id}/program`, { cache: "no-store" }),
      ]);
      const intakeJson = await intakeRes.json();
      if (!intakeRes.ok) throw new Error(intakeJson.error ?? "Couldn't load this client.");
      setProfile(intakeJson.profile);
      setIntake(intakeJson.intake ?? null);
      setMeta(intakeJson.meta ?? null);
      const notesJson = await notesRes.json();
      if (notesRes.ok) setNotes(notesJson.notes ?? []);
      const programJson = await programRes.json();
      if (programRes.ok) setProgram(programJson.program ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);

  // Load assignable trainers (admins only) for the coach selector.
  useEffect(() => {
    if (!viewerIsAdmin || !id) return;
    fetch(`/api/clients/${id}/trainer`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.options)) setTrainerOptions(j.options); })
      .catch(() => {});
  }, [viewerIsAdmin, id]);

  async function assignTrainer(value: string) {
    setAssignBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}/trainer`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_trainer_id: value || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't update trainer.");
      setProfile((p) => p ? { ...p, assigned_trainer_id: j.assigned_trainer_id ?? null, assigned_trainer_name: j.assigned_trainer_name ?? null } : p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update trainer.");
    } finally {
      setAssignBusy(false);
    }
  }

  // Lazy-load the nutrition summary the first time the Nutrition tab is opened.
  useEffect(() => {
    if (tab !== "nutrition" || !id || nutrition || nutritionLoading) return;
    setNutritionLoading(true); setNutritionError(null);
    fetch(`/api/clients/${id}/nutrition`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load nutrition.");
        setNutrition(json as NutritionSummary);
      })
      .catch((e) => setNutritionError(e instanceof Error ? e.message : "Couldn't load nutrition."))
      .finally(() => setNutritionLoading(false));
  }, [tab, id, nutrition, nutritionLoading]);

  async function addNote() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save note.");
      setNotes((prev) => [json.note, ...prev]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== noteId));
    const res = await fetch(`/api/clients/${id}/notes?noteId=${encodeURIComponent(noteId)}`, { method: "DELETE" });
    if (!res.ok) setNotes(prev); // revert on failure
  }

  const name = profile
    ? (profile.full_name?.trim() || `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email || "Client")
    : "Client";

  async function sendThroughOnboarding(complete: boolean) {
    const verb = complete ? "restart onboarding for" : "send";
    if (!confirm(`${complete ? "Restart" : "Send"} ${name} through onboarding?\n\nThey'll be guided through the setup flow the next time they open the app. Their existing answers are kept and pre-filled.`)) return;
    setObBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}/onboarding/reset`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Couldn't ${verb} this client to onboarding.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update onboarding.");
    } finally {
      setObBusy(false);
    }
  }

  const onboardingStatus = useMemo(() => {
    if (meta?.onboarding_complete) return "Complete";
    if (intake) return "In progress";
    return "Not started";
  }, [meta, intake]);

  const week = program ? currentWeek(program.start_date, program.duration_weeks) : null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/50">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading client…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-sm text-red-300/80">{error}</p>
        <button onClick={() => router.back()} className="text-xs text-white/45 hover:text-white/80">← Go back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      {/* Print rules: hide app chrome, show only #print-area */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #print-area, #print-area * { visibility: visible !important; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="px-5 md:px-8 pt-6 max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="no-print inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-1.5">Client file</p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">{name}</h1>
            <p className="text-xs text-white/45 mt-1.5">
              {profile?.email} · <span className="capitalize">{profile?.role}</span> · {profile?.plan}
              {profile?.assigned_trainer_name ? ` · Trainer: ${profile.assigned_trainer_name}` : ""}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2} /> Download PDF
          </button>
        </div>

        {/* ── Stat tiles ── */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <StatTile label="Plan"       value={profile?.plan ?? "—"} capitalize />
          <StatTile label="Onboarding" value={onboardingStatus} />
          <StatTile label="Program"    value={program?.block_name ?? "None"} />
          <StatTile label="Notes"      value={String(notes.length)} />
        </div>

        {/* ── Tab nav ── */}
        <div className="no-print flex items-center gap-1 overflow-x-auto border-b border-white/[0.07] mb-6 -mx-1 px-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
                tab === key
                  ? "border-[#B48B40] text-white"
                  : "border-transparent text-white/45 hover:text-white/75",
              )}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab: onboarding action + intake + prefill ── */}
        {tab === "overview" && (
          <>
            {viewerIsAdmin && (
              <div className="no-print mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85">Assigned coach</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {profile?.assigned_trainer_name
                      ? <>Currently <span className="text-[#B48B40]/80">{profile.assigned_trainer_name}</span></>
                      : "No coach assigned yet."}
                  </p>
                </div>
                <select
                  value={profile?.assigned_trainer_id ?? ""}
                  disabled={assignBusy}
                  onChange={(e) => void assignTrainer(e.target.value)}
                  className="shrink-0 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-white/25 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">— No trainer —</option>
                  {trainerOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="no-print mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {onboardingStatus === "Complete"
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400/80 shrink-0" strokeWidth={1.8} />
                  : <PlayCircle className="w-5 h-5 text-[#B48B40] shrink-0" strokeWidth={1.8} />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/85">Onboarding · {onboardingStatus}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {onboardingStatus === "Complete"
                      ? `Completed${meta?.completed_at ? ` ${new Date(meta.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}. You can run it again any time.`
                      : "Send them into the guided setup flow — they'll start it next time they open the app."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => sendThroughOnboarding(onboardingStatus === "Complete")}
                disabled={obBusy}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
              >
                {obBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" strokeWidth={2} />}
                {onboardingStatus === "Complete" ? "Restart onboarding" : "Send through onboarding"}
              </button>
            </div>
            <div className="no-print mb-6">
              <PrefillPanel clientId={id} onSaved={load} />
            </div>
          </>
        )}
        {/* Printable region: intake. Visible on screen only in Overview, but
            always rendered for print so Download PDF works from any tab. */}
        <div id="print-area" className={tab === "overview" ? "" : "hidden print:block"}>
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-semibold">{name} — Onboarding intake</h2>
            <p className="text-xs text-white/50">{profile?.email}</p>
          </div>
          <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">Onboarding intake</h2>
          <IntakeReadout intake={intake} />
        </div>

        {/* ── Program tab ── */}
        {tab === "program" && (
          <div className="no-print">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Current program
              </h2>
              <Link
                href="/program/builder"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-[#B48B40]/40 hover:text-[#B48B40] transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                {program ? "Change program" : "Assign program"}
              </Link>
            </div>

            {!program ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
                <Dumbbell className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55 mb-1">No active program yet</p>
                <p className="text-xs text-white/30 max-w-xs mx-auto">
                  Build or generate a program, then use “Send to user” in the builder to assign it to {name}.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight truncate">{program.block_name}</h3>
                    <p className="text-xs text-white/45 mt-1 capitalize">{program.goal.replace(/_/g, " ")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/12 text-emerald-300 text-[10px] font-semibold px-2.5 py-1 capitalize">
                    {program.status}
                  </span>
                </div>

                {week !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-white/45 mb-1.5">
                      <span>Week {week} of {program.duration_weeks}</span>
                      <span>{Math.round((week / program.duration_weeks) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-[#B48B40] rounded-full"
                        style={{ width: `${Math.min(100, (week / program.duration_weeks) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
                  <ProgramFact icon={CalendarDays} label="Training days" value={`${program.weekly_training_days}/week`} />
                  <ProgramFact icon={Clock} label="Session length" value={`${program.session_length_target} min`} />
                  <ProgramFact icon={Dumbbell} label="Duration" value={`${program.duration_weeks} weeks`} />
                  {program.start_date && (
                    <ProgramFact icon={CalendarDays} label="Started"
                      value={new Date(program.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
                  )}
                </div>

                {program.body_focus_areas && program.body_focus_areas.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2">Focus</p>
                    <div className="flex flex-wrap gap-1.5">
                      {program.body_focus_areas.map((f) => (
                        <span key={f} className="rounded-full bg-white/[0.05] text-white/65 text-[11px] px-2.5 py-1 capitalize">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {program.coaching_notes && (
                  <div className="mt-5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2">Coaching notes</p>
                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{program.coaching_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Notes tab ── */}
        {tab === "notes" && (
          <div className="no-print">
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Client notes
            </h2>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 mb-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Add a note about this client — observations, adjustments, things to follow up on…"
                className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none resize-y leading-relaxed px-1"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={addNote}
                  disabled={!draft.trim() || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                  Save note
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <p className="text-xs text-white/30 px-1">No notes yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 group">
                    <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-white/30">
                        {n.author_name ?? "Coach"} · {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                      <button
                        onClick={() => deleteNote(n.id)}
                        className={cn("text-white/25 hover:text-red-300/80 transition-colors opacity-0 group-hover:opacity-100")}
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Nutrition tab ── */}
        {tab === "nutrition" && (
          <div className="no-print">
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Apple className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Nutrition
            </h2>
            {nutritionLoading ? (
              <div className="flex items-center justify-center py-12 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading nutrition…
              </div>
            ) : nutritionError ? (
              <p className="text-xs text-red-300/80 px-1">{nutritionError}</p>
            ) : !nutrition || nutrition.totalMeals14 === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
                <Apple className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55 mb-1">No meals logged in the last 14 days</p>
                <p className="text-xs text-white/30">Once {name} logs meals, their intake and trends show here.</p>
              </div>
            ) : (
              <NutritionPanel n={nutrition} />
            )}
          </div>
        )}

        {/* ── Not-yet-built tabs ── */}
        {tab === "progress" && <ComingSoon icon={LineChart} title="Progress" blurb="Bodyweight chart, progress photos, and measurement trends — clickable to drill into each chart." />}
        {tab === "chat" && <ComingSoon icon={MessageSquare} title="Chat" blurb={`The shared coaching conversation with ${name} will appear here, mirrored from their side.`} />}
      </div>
    </div>
  );
}

function StatTile({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">{label}</p>
      <p className={cn("text-sm font-semibold text-white/90 truncate", capitalize && "capitalize")}>{value}</p>
    </div>
  );
}

function ProgramFact({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" strokeWidth={1.8} /> {label}
      </p>
      <p className="text-sm font-medium text-white/85">{value}</p>
    </div>
  );
}

function NutritionPanel({ n }: { n: NutritionSummary }) {
  const maxCal = Math.max(1, ...n.days.map((d) => d.calories));
  const today = n.today;
  return (
    <div className="space-y-5">
      {/* 7-day averages */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2 px-0.5">7-day average · {n.daysLogged7} day{n.daysLogged7 === 1 ? "" : "s"} logged</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <MacroTile label="Calories" value={n.avg.calories} unit="kcal" />
          <MacroTile label="Protein"  value={n.avg.protein}  unit="g" />
          <MacroTile label="Carbs"    value={n.avg.carbs}    unit="g" />
          <MacroTile label="Fat"      value={n.avg.fat}      unit="g" />
        </div>
      </div>

      {/* Today */}
      {today && today.meals > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2">Today · {today.meals} meal{today.meals === 1 ? "" : "s"}</p>
          <p className="text-sm text-white/80">
            <span className="font-semibold">{today.calories}</span> kcal ·
            <span className="text-white/55"> {today.protein}g P · {today.carbs}g C · {today.fat}g F</span>
          </p>
        </div>
      )}

      {/* 14-day calories mini chart */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2 px-0.5">Calories · last 14 days</p>
        <div className="flex items-end gap-1 h-24 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
          {n.days.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative" title={`${d.date}: ${d.calories} kcal`}>
              <div
                className={cn("w-full rounded-sm transition-colors", d.calories > 0 ? "bg-[#B48B40]/70 group-hover:bg-[#B48B40]" : "bg-white/[0.05]")}
                style={{ height: `${d.calories > 0 ? Math.max(6, (d.calories / maxCal) * 100) : 4}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Recent meals */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2 px-0.5">Recent meals</p>
        <div className="space-y-2">
          {n.recentMeals.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-white/70 capitalize">{m.meal_type ?? "meal"}</span>
                <span className="text-[10px] text-white/30">
                  {new Date(m.logged_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {m.label && <p className="text-sm text-white/75 mt-1 leading-relaxed">{m.label}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/45">
                <span>{m.calories} kcal</span>
                <span>{m.protein}g protein</span>
                {m.needs_review && <span className="text-amber-400/70">· needs review</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MacroTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">{label}</p>
      <p className="text-sm font-semibold text-white/90">{value}<span className="text-white/40 font-normal text-xs"> {unit}</span></p>
    </div>
  );
}

function ComingSoon({ icon: Icon, title, blurb }: { icon: typeof User; title: string; blurb: string }) {
  return (
    <div className="no-print rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] px-5 py-12 text-center">
      <Icon className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-semibold text-white/70 mb-1">{title}</p>
      <p className="text-xs text-white/35 max-w-xs mx-auto leading-relaxed">{blurb}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#B48B40]/70 mt-4">Coming next</p>
    </div>
  );
}
