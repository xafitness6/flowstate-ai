"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Check,
  Calendar,
  ChevronDown,
  Dumbbell,
  Users,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssignmentStatus = "draft" | "active" | "needs_review";

type Client = {
  id: string;
  name: string;
  initials: string;
  goal: string;
  status: "active" | "inactive" | "new";
  currentProgram?: string;
};

type Program = {
  id: string;
  name: string;
  phase: string;
  weeks: number;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "fat_loss";
  exercises: number;
  description: string;
  lastUsed?: string;
};

type Goal = "strength" | "hypertrophy" | "fat_loss" | "performance";

// ─── Mock data ────────────────────────────────────────────────────────────────

const CLIENTS: Client[] = [
  { id: "c1", name: "Jordan Mitchell",  initials: "JM", goal: "Hypertrophy",  status: "active",   currentProgram: "Upper/Lower Split" },
  { id: "c2", name: "Alyssa Torres",    initials: "AT", goal: "Fat loss",     status: "active",   currentProgram: "Full Body Circuit" },
  { id: "c3", name: "Marcus Webb",      initials: "MW", goal: "Strength",     status: "inactive" },
  { id: "c4", name: "Priya Nair",       initials: "PN", goal: "Performance",  status: "new" },
  { id: "c5", name: "Devon Clarke",     initials: "DC", goal: "Hypertrophy",  status: "active",   currentProgram: "Push/Pull/Legs" },
];

const PROGRAMS: Program[] = [
  {
    id: "p1",
    name: "Upper / Lower Split",
    phase: "Phase 1 — Foundation",
    weeks: 8,
    daysPerWeek: 4,
    goal: "hypertrophy",
    exercises: 6,
    description: "4-day upper/lower structure focused on progressive overload. Best for intermediate lifters building volume base.",
    lastUsed: "2 days ago",
  },
  {
    id: "p2",
    name: "Push / Pull / Legs",
    phase: "Phase 2 — Volume",
    weeks: 6,
    daysPerWeek: 6,
    goal: "hypertrophy",
    exercises: 7,
    description: "High-frequency 6-day PPL designed for advanced clients with strong recovery capacity.",
    lastUsed: "1 week ago",
  },
  {
    id: "p3",
    name: "5/3/1 Strength Block",
    phase: "Phase 1 — Strength",
    weeks: 4,
    daysPerWeek: 4,
    goal: "strength",
    exercises: 5,
    description: "Wendler-style percentage training. Four main lifts across four days with assistance work.",
  },
  {
    id: "p4",
    name: "Metabolic Circuit",
    phase: "Phase 1 — Conditioning",
    weeks: 6,
    daysPerWeek: 3,
    goal: "fat_loss",
    exercises: 8,
    description: "High-density circuit training combining compound lifts with conditioning finishers.",
    lastUsed: "3 weeks ago",
  },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "strength",    label: "Strength" },
  { value: "fat_loss",    label: "Fat Loss" },
  { value: "performance", label: "Performance" },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const GOAL_COLORS: Record<Program["goal"], string> = {
  strength:    "text-[#93C5FD] bg-[#93C5FD]/8 border-[#93C5FD]/20",
  hypertrophy: "text-[#B48B40] bg-[#B48B40]/8 border-[#B48B40]/20",
  fat_loss:    "text-emerald-400 bg-emerald-400/8 border-emerald-400/20",
};

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; color: string }> = {
  draft:        { label: "Draft",        color: "text-white/40 bg-white/5 border-white/10" },
  active:       { label: "Active",       color: "text-emerald-400 bg-emerald-400/8 border-emerald-400/20" },
  needs_review: { label: "Needs Review", color: "text-[#FBBF24] bg-[#FBBF24]/8 border-[#FBBF24]/20" },
};

const CLIENT_STATUS_DOT: Record<Client["status"], string> = {
  active:   "bg-emerald-400",
  inactive: "bg-white/20",
  new:      "bg-[#B48B40]",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("text-[10px] font-medium tracking-[0.1em] uppercase px-2 py-1 rounded-lg border", cfg.color)}>
      {cfg.label}
    </span>
  );
}

function ProgramPreview({ program }: { program: Program }) {
  return (
    <div className="rounded-2xl border border-[#6f4a17]/40 bg-[#0e0d0b] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/25 mb-1">
            {program.phase}
          </p>
          <h3 className="text-base font-semibold text-white/90">{program.name}</h3>
        </div>
        <span className={cn("text-[10px] font-medium tracking-[0.08em] uppercase px-2 py-1 rounded-lg border shrink-0", GOAL_COLORS[program.goal])}>
          {program.goal.replace("_", " ")}
        </span>
      </div>

      <p className="text-sm text-white/45 leading-relaxed">{program.description}</p>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Duration",   value: `${program.weeks}w` },
          { label: "Days/week",  value: String(program.daysPerWeek) },
          { label: "Exercises",  value: `${program.exercises}/session` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/25 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white/80 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {program.lastUsed && (
        <p className="text-xs text-white/25">Last assigned {program.lastUsed}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssignProgramPage() {
  const [clientQuery, setClientQuery]     = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [startDate, setStartDate]         = useState("");
  const [daysPerWeek, setDaysPerWeek]     = useState<number>(4);
  const [goal, setGoal]                   = useState<Goal>("hypertrophy");
  const [coachNote, setCoachNote]         = useState("");
  const [status, setStatus]               = useState<AssignmentStatus>("draft");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assigned, setAssigned]           = useState(false);

  const filteredClients = useMemo(() => {
    const q = clientQuery.toLowerCase().trim();
    if (!q) return CLIENTS;
    return CLIENTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.goal.toLowerCase().includes(q)
    );
  }, [clientQuery]);

  const canAssign = selectedClient && selectedProgram && startDate;

  function handleAssign() {
    if (!canAssign) return;
    setAssigned(true);
    setStatus("active");
  }

  return (
    <div className="px-5 md:px-8 py-6 text-white max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/30 mb-3">
            Program · Assign
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Assign program</h1>
        </div>

        {/* Status selector */}
        <div className="relative mt-1">
          <button
            onClick={() => setStatusMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm hover:border-white/20 transition-all"
          >
            <StatusBadge status={status} />
            <ChevronDown className="w-3.5 h-3.5 text-white/30" strokeWidth={1.5} />
          </button>

          {statusMenuOpen && (
            <div className="absolute top-full mt-1.5 right-0 rounded-xl border border-white/10 bg-[#161616] overflow-hidden shadow-2xl min-w-[160px] z-10">
              {(Object.keys(STATUS_CONFIG) as AssignmentStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setStatusMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors"
                >
                  <StatusBadge status={s} />
                  {status === s && <Check className="w-3.5 h-3.5 text-[#B48B40]" strokeWidth={2} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 px-0">

        {/* ── Left column ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Client selection */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-white/30" strokeWidth={1.5} />
                <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                  Select client
                </p>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" strokeWidth={1.5} />
                <input
                  type="text"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full bg-white/[0.03] border border-white/6 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all"
                />
              </div>

              {/* Client list */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredClients.length === 0 && (
                  <p className="text-sm text-white/25 text-center py-4">No clients found.</p>
                )}
                {filteredClients.map((client) => {
                  const selected = selectedClient?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                        selected
                          ? "bg-[#B48B40]/8 border border-[#B48B40]/25"
                          : "hover:bg-white/[0.03] border border-transparent"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                        selected ? "bg-[#B48B40]/20 text-[#B48B40]" : "bg-white/6 text-white/50"
                      )}>
                        {client.initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium truncate", selected ? "text-white/90" : "text-white/70")}>
                            {client.name}
                          </span>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", CLIENT_STATUS_DOT[client.status])} />
                        </div>
                        <p className="text-xs text-white/30 truncate">{client.goal}</p>
                      </div>

                      {client.currentProgram && (
                        <span className="text-[10px] text-white/25 truncate max-w-[100px] hidden sm:block">
                          {client.currentProgram}
                        </span>
                      )}

                      {selected && (
                        <Check className="w-4 h-4 text-[#B48B40] shrink-0" strokeWidth={2} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Program selection */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Dumbbell className="w-4 h-4 text-white/30" strokeWidth={1.5} />
                <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                  Select program
                </p>
              </div>

              <div className="space-y-2">
                {PROGRAMS.map((program) => {
                  const selected = selectedProgram?.id === program.id;
                  return (
                    <button
                      key={program.id}
                      onClick={() => setSelectedProgram(program)}
                      className={cn(
                        "w-full flex items-start gap-4 px-4 py-3.5 rounded-xl text-left transition-all",
                        selected
                          ? "bg-[#B48B40]/8 border border-[#B48B40]/25"
                          : "border border-white/6 hover:border-white/12 hover:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-sm font-medium", selected ? "text-white/95" : "text-white/75")}>
                            {program.name}
                          </span>
                          <span className={cn("text-[10px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-md border shrink-0", GOAL_COLORS[program.goal])}>
                            {program.goal.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs text-white/30">{program.phase} · {program.weeks}w · {program.daysPerWeek}d/wk</p>
                      </div>

                      {selected && (
                        <Check className="w-4 h-4 text-[#B48B40] shrink-0 mt-0.5" strokeWidth={2} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assignment config */}
          <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-5 space-y-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white/30" strokeWidth={1.5} />
              <p className="text-xs uppercase tracking-[0.18em] text-white/30">
                Configuration
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start date */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 block mb-2">
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-[#B48B40]/40 focus:bg-[#B48B40]/5 transition-all [color-scheme:dark]"
                />
              </div>

              {/* Goal override */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 block mb-2">
                  Client goal
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGoal(opt.value)}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                        goal === opt.value
                          ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                          : "border-white/8 text-white/40 hover:border-white/15 hover:text-white/60"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Days per week */}
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 block mb-2">
                Training days / week
              </label>
              <div className="flex gap-2">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDaysPerWeek(d)}
                    className={cn(
                      "w-10 h-10 rounded-xl border text-sm font-medium transition-all",
                      daysPerWeek === d
                        ? "border-[#B48B40]/40 bg-[#B48B40]/8 text-[#B48B40]"
                        : "border-white/8 text-white/40 hover:border-white/20 hover:text-white/65"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Coach notes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-white/25" strokeWidth={1.5} />
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25">
                  Coach notes
                </label>
              </div>
              <textarea
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
                placeholder="Add context, cues, or instructions for this client's program..."
                rows={3}
                className="w-full bg-white/[0.03] border border-white/6 rounded-xl px-3 py-2.5 text-sm text-white/70 placeholder:text-white/20 resize-none outline-none focus:border-[#B48B40]/40 transition-all leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* ── Right column ───────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Selected client summary */}
          {selectedClient ? (
            <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/25 mb-3">Client</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#B48B40]/15 flex items-center justify-center text-sm font-semibold text-[#B48B40] shrink-0">
                  {selectedClient.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">{selectedClient.name}</p>
                  <p className="text-xs text-white/35 mt-0.5">{selectedClient.goal}</p>
                </div>
                <span className={cn("ml-auto w-2 h-2 rounded-full", CLIENT_STATUS_DOT[selectedClient.status])} />
              </div>
              {selectedClient.currentProgram && (
                <div className="mt-3 pt-3 border-t border-white/6">
                  <p className="text-xs text-white/25">
                    Current program:{" "}
                    <span className="text-white/45">{selectedClient.currentProgram}</span>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/8 px-5 py-6 text-center">
              <Users className="w-5 h-5 text-white/15 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-white/25">No client selected</p>
            </div>
          )}

          {/* Program preview */}
          {selectedProgram ? (
            <ProgramPreview program={selectedProgram} />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/8 px-5 py-6 text-center">
              <Dumbbell className="w-5 h-5 text-white/15 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-white/25">No program selected</p>
            </div>
          )}

          {/* Assignment summary */}
          {canAssign && (
            <div className="rounded-2xl border border-white/8 bg-[#111111] px-5 py-4 space-y-2.5">
              <p className="text-xs uppercase tracking-[0.18em] text-white/25 mb-3">Summary</p>
              {[
                { label: "Client",    value: selectedClient!.name },
                { label: "Program",   value: selectedProgram!.name },
                { label: "Starts",    value: new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                { label: "Days/wk",   value: String(daysPerWeek) },
                { label: "Goal",      value: goal.replace("_", " ") },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-white/30">{label}</span>
                  <span className="text-xs font-medium text-white/70 capitalize">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleAssign}
            disabled={!canAssign}
            className={cn(
              "w-full rounded-2xl py-3.5 text-sm font-semibold tracking-wide transition-all",
              assigned
                ? "bg-white/5 text-white/35 cursor-default"
                : canAssign
                ? "bg-[#B48B40] text-black hover:bg-[#c99840]"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            {assigned ? "Program assigned ✓" : "Assign program"}
          </button>

          {assigned && (
            <p className="text-xs text-emerald-400/70 text-center">
              {selectedClient?.name} has been notified.
            </p>
          )}

          {!canAssign && !assigned && (
            <p className="text-xs text-white/20 text-center -mt-2">
              {!selectedClient
                ? "Select a client to continue"
                : !selectedProgram
                ? "Select a program to continue"
                : "Set a start date to continue"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
