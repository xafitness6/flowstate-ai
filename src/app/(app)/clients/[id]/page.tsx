"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Download, Loader2, Trash2, StickyNote, Send,
  User, Dumbbell, Apple, LineChart, MessageSquare,
  CalendarDays, Clock, PlayCircle, CheckCircle2,
  Activity, Camera, Image as ImageIcon, Scale, TrendingUp, Upload, Bell,
  Pencil, Check, X, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IntakeReadout } from "@/components/intake/IntakeReadout";
import { ClientNutritionManager } from "@/components/clients/ClientNutritionManager";
import { ClientAccountActions } from "@/components/clients/ClientAccountActions";
import { ClientTasksManager } from "@/components/clients/ClientTasksManager";
import { ClientAIBreakdown } from "@/components/clients/ClientAIBreakdown";
import { PrefillPanel } from "@/components/intake/PrefillPanel";
import { EnergyCard } from "@/components/nutrition/EnergyCard";
import { ApproachSummary } from "@/components/nutrition/ApproachSummary";
import { goalModeFromIntake, type ApproachState } from "@/lib/nutrition/approach";
import { useUser } from "@/context/UserContext";
import type { RawIntake } from "@/lib/intake/format";
import { weightLabel, heightLabel } from "@/lib/intake/format";
import type { EnergyProfile } from "@/lib/nutrition";
import {
  inferUnitSystemFromRawAnswers,
  readStoredUnitSystem,
  kgToDisplayUnit,
  displayUnitToKg,
  weightUnitLabel,
  type UnitSystem,
} from "@/lib/units";

type ClientProfile = {
  id: string; full_name: string | null; first_name: string | null; last_name: string | null;
  email: string | null; role: string; plan: string;
  assigned_trainer_id: string | null;
  assigned_trainer_name: string | null;
};
type Note = { id: string; body: string; author_name: string | null; created_at: string; shared_with_client?: boolean };
type Reminder = { id: string; body: string; due_date: string | null; done: boolean; created_at: string };
type CalendarReminder = { id: string; title: string; notes: string | null; due_at: string; done: boolean; created_at: string };
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
  energy: EnergyProfile | null;
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number } | null;
};

type ActivitySummary = {
  sessions: number;
  currentStreak: number;
  longestStreak: number;
  last30: number;
  last7: number;
  thisWeek: number;
  lastActivityAt: string | null;
  days: { date: string; sessions: number; minutes: number }[];
  recentSessions: {
    id: string;
    workout_name: string;
    completed_at: string;
    duration_minutes: number;
    sets_completed: number;
    difficulty: number | null;
  }[];
};

type WeightLog = {
  id: string;
  logged_at: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
};

type ProgressPhoto = {
  id: string;
  caption: string | null;
  taken_at: string;
  created_at: string;
  signed_url: string | null;
};

type TabKey = "overview" | "info" | "program" | "nutrition" | "progress" | "notes" | "chat";

const TABS: { key: TabKey; label: string; icon: typeof User; ready: boolean }[] = [
  { key: "overview",  label: "Dashboard",   icon: User,          ready: true  },
  { key: "info",      label: "Client info", icon: ClipboardList, ready: true  },
  { key: "program",   label: "Program",     icon: Dumbbell,      ready: true  },
  { key: "nutrition", label: "Nutrition", icon: Apple,         ready: true  },
  { key: "progress",  label: "Progress",  icon: LineChart,     ready: true  },
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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortWeightLogs(logs: WeightLog[]) {
  return [...logs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
}

function sortCalendarReminders(items: CalendarReminder[]) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: viewer } = useUser();
  const viewerIsAdmin = viewer.role === "master" || !!viewer.isAdmin;
  const id = params?.id as string;

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [intake,  setIntake]  = useState<RawIntake | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  // Weight is stored canonically as kg; display in the viewing trainer's
  // preferred unit, falling back to the client's onboarding answers, then metric.
  const [viewerUnit, setViewerUnit] = useState<UnitSystem | null>(null);
  useEffect(() => { setViewerUnit(readStoredUnitSystem(viewer.id)); }, [viewer.id]);
  const unitSystem: UnitSystem = useMemo(
    () => viewerUnit ?? inferUnitSystemFromRawAnswers(intake) ?? "metric",
    [viewerUnit, intake],
  );
  const [meta,    setMeta]    = useState<IntakeMeta>(null);
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [program, setProgram] = useState<ClientProgram>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<TabKey>("overview");

  const [draft, setDraft] = useState("");
  const [shareNew, setShareNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [obBusy, setObBusy] = useState(false);

  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionError, setNutritionError] = useState<string | null>(null);
  const [clientApproach, setClientApproach] = useState<ApproachState | null>(null);

  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const [trainerOptions, setTrainerOptions] = useState<{ value: string; label: string }[]>([]);
  const [assignBusy, setAssignBusy] = useState(false);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reminderDraft, setReminderDraft] = useState("");
  const [reminderDue, setReminderDue] = useState("");
  const [remindersLoaded, setRemindersLoaded] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [editRemId, setEditRemId] = useState<string | null>(null);
  const [editRemBody, setEditRemBody] = useState("");
  const [editRemDue, setEditRemDue] = useState("");
  const [editRemSaving, setEditRemSaving] = useState(false);

  const [calendarReminders, setCalendarReminders] = useState<CalendarReminder[]>([]);
  const [calendarReminderDraft, setCalendarReminderDraft] = useState("");
  const [calendarReminderDate, setCalendarReminderDate] = useState(todayInputValue);
  const [calendarReminderTime, setCalendarReminderTime] = useState("09:00");
  const [calendarRemindersLoaded, setCalendarRemindersLoaded] = useState(false);
  const [calendarReminderSaving, setCalendarReminderSaving] = useState(false);
  const [editCalId, setEditCalId] = useState<string | null>(null);
  const [editCalTitle, setEditCalTitle] = useState("");
  const [editCalDate, setEditCalDate] = useState("");
  const [editCalTime, setEditCalTime] = useState("");
  const [editCalSaving, setEditCalSaving] = useState(false);

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState("");
  const [weightDate, setWeightDate] = useState(todayInputValue);
  const [weightNote, setWeightNote] = useState("");
  const [weightSaving, setWeightSaving] = useState(false);
  const [selectedWeightId, setSelectedWeightId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(todayInputValue);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoInputKey, setPhotoInputKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [intakeRes, notesRes, programRes, weightRes] = await Promise.all([
        fetch(`/api/clients/${id}/intake`,  { cache: "no-store" }),
        fetch(`/api/clients/${id}/notes`,   { cache: "no-store" }),
        fetch(`/api/clients/${id}/program`, { cache: "no-store" }),
        fetch(`/api/clients/${id}/weight`,  { cache: "no-store" }),
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
      // Weight is loaded eagerly so it shows in BOTH the Nutrition and Progress
      // tabs (not just Progress).
      const weightJson = await weightRes.json();
      if (weightRes.ok) setWeightLogs(sortWeightLogs((weightJson.logs ?? []) as WeightLog[]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);

  // This page is REUSED (not remounted) when navigating between client files, so
  // the lazily-loaded per-tab caches must be cleared on id change — otherwise a
  // new client shows the previous client's (or no) data. Each tab's loader
  // re-runs once its "loaded" flag is reset.
  useEffect(() => {
    setNutrition(null); setNutritionError(null);
    setActivitySummary(null);
    setWeightLogs([]); setPhotos([]); setProgressLoaded(false); setProgressError(null);
    setReminders([]); setRemindersLoaded(false);
    setCalendarReminders([]); setCalendarRemindersLoaded(false);
    setEngagement(null);
  }, [id]);

  // Engagement: Learn progress + login frequency (coach view).
  useEffect(() => {
    if (!id) return;
    fetch(`/api/clients/${id}/engagement`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setEngagement(j as EngagementData))
      .catch(() => {});
  }, [id]);

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
    // Approach lives on profiles.nutrition_approach — silent if migration 030
    // hasn't been applied yet.
    fetch(`/api/clients/${id}/nutrition-approach`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json() as { approach?: ApproachState | null };
        if (json.approach) setClientApproach(json.approach);
      })
      .catch(() => { /* silent */ });
  }, [tab, id, nutrition, nutritionLoading]);

  // Lazy-load training activity for the trainer-only snapshot tabs.
  useEffect(() => {
    if (!["program", "nutrition", "progress"].includes(tab) || !id || activitySummary || activityLoading) return;
    setActivityLoading(true);
    fetch(`/api/clients/${id}/activity`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load activity.");
        setActivitySummary(json as ActivitySummary);
      })
      .catch(() => setActivitySummary(null))
      .finally(() => setActivityLoading(false));
  }, [tab, id, activitySummary, activityLoading]);

  // Lazy-load Progress tab data. GET routes are resilient while migration 024 is pending.
  useEffect(() => {
    if (tab !== "progress" || !id || progressLoaded) return;
    setProgressLoaded(true);
    setProgressLoading(true);
    setProgressError(null);

    Promise.all([
      fetch(`/api/clients/${id}/weight`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/clients/${id}/photos`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([weightJson, photoJson]) => {
        setWeightLogs(sortWeightLogs((weightJson.logs ?? []) as WeightLog[]));
        setPhotos((photoJson.photos ?? []) as ProgressPhoto[]);
      })
      .catch((e) => setProgressError(e instanceof Error ? e.message : "Couldn't load progress."))
      .finally(() => setProgressLoading(false));
  }, [tab, id, progressLoaded]);

  // Lazy-load trainer reminders the first time the Notes tab is opened.
  useEffect(() => {
    if (tab !== "notes" || !id || remindersLoaded) return;
    setRemindersLoaded(true);
    fetch(`/api/clients/${id}/reminders`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setReminders(j.reminders ?? []))
      .catch(() => {});
  }, [tab, id, remindersLoaded]);

  // Lazy-load client-visible calendar reminders separately from private follow-ups.
  useEffect(() => {
    if (tab !== "notes" || !id || calendarRemindersLoaded) return;
    setCalendarRemindersLoaded(true);
    fetch(`/api/clients/${id}/calendar-reminders`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCalendarReminders(sortCalendarReminders((j.reminders ?? []) as CalendarReminder[])))
      .catch(() => {});
  }, [tab, id, calendarRemindersLoaded]);

  async function addReminder() {
    const body = reminderDraft.trim();
    if (!body || reminderSaving) return;
    setReminderSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/reminders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, due_date: reminderDue || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't add reminder.");
      setReminders((prev) => [j.reminder, ...prev]);
      setReminderDraft(""); setReminderDue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add reminder.");
    } finally {
      setReminderSaving(false);
    }
  }

  async function toggleReminder(rid: string, done: boolean) {
    setReminders((prev) => prev.map((r) => (r.id === rid ? { ...r, done } : r)));
    await fetch(`/api/clients/${id}/reminders`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rid, done }),
    }).catch(() => {});
  }

  async function deleteReminder(rid: string) {
    const prev = reminders;
    setReminders((p) => p.filter((r) => r.id !== rid));
    const res = await fetch(`/api/clients/${id}/reminders?id=${encodeURIComponent(rid)}`, { method: "DELETE" });
    if (!res.ok) setReminders(prev);
  }

  function startEditReminder(r: Reminder) {
    setEditRemId(r.id);
    setEditRemBody(r.body);
    setEditRemDue(r.due_date ?? "");
  }
  function cancelEditReminder() { setEditRemId(null); }
  async function saveEditReminder(rid: string) {
    const body = editRemBody.trim();
    if (!body || editRemSaving) return;
    setEditRemSaving(true);
    try {
      const due_date = editRemDue || null;
      const res = await fetch(`/api/clients/${id}/reminders`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rid, body, due_date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't update reminder.");
      setReminders((prev) => prev.map((r) => (r.id === rid ? { ...r, body, due_date } : r)));
      setEditRemId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update reminder.");
    } finally {
      setEditRemSaving(false);
    }
  }

  async function addCalendarReminder() {
    const title = calendarReminderDraft.trim();
    if (!title || calendarReminderSaving) return;
    setCalendarReminderSaving(true);
    try {
      // Interpret the entered wall-clock time in the coach's local zone and
      // store the absolute instant, so the client sees it in THEIR zone.
      const dueAt = new Date(`${calendarReminderDate || todayInputValue()}T${calendarReminderTime || "09:00"}`).toISOString();
      const res = await fetch(`/api/clients/${id}/calendar-reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, due_at: dueAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't add calendar reminder.");
      setCalendarReminders((prev) => sortCalendarReminders([json.reminder as CalendarReminder, ...prev]));
      setCalendarReminderDraft("");
      setCalendarReminderDate(todayInputValue());
      setCalendarReminderTime("09:00");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add calendar reminder.");
    } finally {
      setCalendarReminderSaving(false);
    }
  }

  async function toggleCalendarReminder(rid: string, done: boolean) {
    const prev = calendarReminders;
    setCalendarReminders((items) => sortCalendarReminders(items.map((r) => (r.id === rid ? { ...r, done } : r))));
    const res = await fetch(`/api/clients/${id}/calendar-reminders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rid, done }),
    });
    if (!res.ok) setCalendarReminders(prev);
  }

  async function deleteCalendarReminder(rid: string) {
    const prev = calendarReminders;
    setCalendarReminders((items) => items.filter((r) => r.id !== rid));
    const res = await fetch(`/api/clients/${id}/calendar-reminders?id=${encodeURIComponent(rid)}`, { method: "DELETE" });
    if (!res.ok) setCalendarReminders(prev);
  }

  function startEditCalReminder(r: CalendarReminder) {
    const d = new Date(r.due_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditCalId(r.id);
    setEditCalTitle(r.title);
    setEditCalDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setEditCalTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }
  function cancelEditCalReminder() { setEditCalId(null); }
  async function saveEditCalReminder(rid: string) {
    const title = editCalTitle.trim();
    if (!title || editCalSaving) return;
    setEditCalSaving(true);
    try {
      const dueAt = new Date(`${editCalDate || todayInputValue()}T${editCalTime || "09:00"}`).toISOString();
      const res = await fetch(`/api/clients/${id}/calendar-reminders`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rid, title, due_at: dueAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't update calendar reminder.");
      setCalendarReminders((prev) => sortCalendarReminders(prev.map((r) => (r.id === rid ? (json.reminder as CalendarReminder) : r))));
      setEditCalId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update calendar reminder.");
    } finally {
      setEditCalSaving(false);
    }
  }

  async function addWeightLog() {
    if (weightSaving) return;
    const weight = Number(weightDraft);
    if (!Number.isFinite(weight) || weight <= 0) return;

    setWeightSaving(true);
    setProgressError(null);
    try {
      const res = await fetch(`/api/clients/${id}/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: displayUnitToKg(weight, unitSystem), logged_at: weightDate, note: weightNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save weight.");
      const log = json.log as WeightLog;
      setWeightLogs((prev) => sortWeightLogs([...prev, log]));
      setSelectedWeightId(log.id);
      setWeightDraft("");
      setWeightNote("");
      setWeightDate(todayInputValue());
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : "Couldn't save weight.");
    } finally {
      setWeightSaving(false);
    }
  }

  async function deleteWeightLog(logId: string) {
    const prev = weightLogs;
    setWeightLogs((logs) => logs.filter((log) => log.id !== logId));
    if (selectedWeightId === logId) setSelectedWeightId(null);
    const res = await fetch(`/api/clients/${id}/weight?id=${encodeURIComponent(logId)}`, { method: "DELETE" });
    if (!res.ok) setWeightLogs(prev);
  }

  async function uploadPhoto() {
    if (!photoFile || photoUploading) return;

    setPhotoUploading(true);
    setProgressError(null);
    try {
      const body = new FormData();
      body.set("file", photoFile);
      body.set("taken_at", photoDate);
      body.set("caption", photoCaption);

      const res = await fetch(`/api/clients/${id}/photos`, { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't upload photo.");
      setPhotos((prev) => [json.photo as ProgressPhoto, ...prev]);
      setPhotoFile(null);
      setPhotoCaption("");
      setPhotoDate(todayInputValue());
      setPhotoInputKey((k) => k + 1);
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : "Couldn't upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const prev = photos;
    setPhotos((p) => p.filter((photo) => photo.id !== photoId));
    const res = await fetch(`/api/clients/${id}/photos?id=${encodeURIComponent(photoId)}`, { method: "DELETE" });
    if (!res.ok) setPhotos(prev);
  }

  async function addNote() {
    const body = draft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, shared: shareNew }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save note.");
      setNotes((prev) => [json.note, ...prev]);
      setDraft("");
      setShareNew(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save note.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleShareNote(noteId: string, shared: boolean) {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, shared_with_client: shared } : n)));
    const res = await fetch(`/api/clients/${id}/notes`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, shared }),
    });
    if (!res.ok) setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, shared_with_client: !shared } : n)));
  }

  function startEditNote(note: Note) {
    setEditingNoteId(note.id);
    setEditDraft(note.body);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditDraft("");
  }

  async function saveEditNote(noteId: string) {
    const body = editDraft.trim();
    if (!body || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}/notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't update note.");
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...json.note } : n)));
      cancelEditNote();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update note.");
    } finally {
      setEditSaving(false);
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

  async function markOnboardingDone() {
    if (!confirm(`Mark ${name}'s onboarding as complete? Use this if you filled it out with them.`)) return;
    setObBusy(true);
    try {
      const res = await fetch(`/api/clients/${id}/onboarding/complete`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't mark complete.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark complete.");
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
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-1.5">Client dashboard</p>
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
            <ClientAIBreakdown clientId={id} />
            <EngagementCard data={engagement} />
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
                      : "Send them into the guided setup, or fill it in yourself below (Pre-fill from notes) and mark it complete."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onboardingStatus !== "Complete" && (
                  <button
                    onClick={markOnboardingDone}
                    disabled={obBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/[0.14] disabled:opacity-50 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Mark complete
                  </button>
                )}
                <button
                  onClick={() => sendThroughOnboarding(onboardingStatus === "Complete")}
                  disabled={obBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
                >
                  {obBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" strokeWidth={2} />}
                  {onboardingStatus === "Complete" ? "Restart onboarding" : "Send through onboarding"}
                </button>
              </div>
            </div>
            <ClientAccountActions clientId={id} clientName={name} />
            <div className="no-print mb-6">
              <PrefillPanel clientId={id} onSaved={load} />
            </div>
          </>
        )}
        {/* Client info tab — vitals + the full onboarding intake. */}
        {tab === "info" && <div className="no-print"><ClientVitals intake={intake} /></div>}

        {/* Printable region: intake. Visible on screen in the Client info tab,
            but always rendered for print so Download PDF works from any tab. */}
        <div id="print-area" className={tab === "info" ? "" : "hidden print:block"}>
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
            <ProgramSnapshot activity={activitySummary} program={program} loading={activityLoading} />

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Current program
              </h2>
              <div className="flex items-center gap-1.5">
                {program && (
                  <Link
                    href={`/program/builder?clientId=${id}&client=${encodeURIComponent(name)}&edit=1`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:border-[#B48B40]/40 hover:text-[#B48B40] transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2} /> Edit
                  </Link>
                )}
                <Link
                  href={`/program/builder?clientId=${id}&client=${encodeURIComponent(name)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#B48B40]/30 bg-[#B48B40]/[0.08] px-3 py-2 text-xs font-semibold text-[#B48B40] hover:bg-[#B48B40]/[0.14] transition-all"
                >
                  <Dumbbell className="w-3.5 h-3.5" strokeWidth={2} />
                  {program ? "New program" : "Build program"}
                </Link>
              </div>
            </div>

            {!program ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
                <Dumbbell className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55 mb-1">No active program yet</p>
                <p className="text-xs text-white/30 max-w-xs mx-auto">
                  Tap <span className="text-white/50 font-medium">Build program</span> to create a multi-week plan for {name} — it&apos;s saved straight to their account.
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
            <ClientTasksManager clientId={id} clientName={name} />
            {/* Calendar reminders — visible to the client/member. */}
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Client calendar reminders
              <span className="text-[10px] font-normal text-white/30">· visible on their calendar</span>
            </h2>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
              <input
                value={calendarReminderDraft}
                onChange={(e) => setCalendarReminderDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addCalendarReminder(); }}
                placeholder="Add to their calendar - e.g. weigh in Friday, upload progress photos..."
                className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
              />
              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={calendarReminderDate}
                    onChange={(e) => setCalendarReminderDate(e.target.value)}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={calendarReminderTime}
                    onChange={(e) => setCalendarReminderTime(e.target.value)}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]"
                  />
                </div>
                <button
                  onClick={addCalendarReminder}
                  disabled={!calendarReminderDraft.trim() || calendarReminderSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
                >
                  {calendarReminderSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                  Add
                </button>
              </div>
            </div>
            {calendarReminders.length > 0 ? (
              <div className="space-y-1.5 mb-6">
                {calendarReminders.map((r) => (
                  editCalId === r.id ? (
                    <div key={r.id} className="rounded-xl border border-[#B48B40]/30 bg-white/[0.03] px-3 py-2.5">
                      <input
                        value={editCalTitle}
                        onChange={(e) => setEditCalTitle(e.target.value)}
                        autoFocus
                        className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
                      />
                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <input type="date" value={editCalDate} onChange={(e) => setEditCalDate(e.target.value)}
                            className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]" />
                          <input type="time" value={editCalTime} onChange={(e) => setEditCalTime(e.target.value)}
                            className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={cancelEditCalReminder} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1 transition-colors">
                            <X className="w-3 h-3" strokeWidth={2} /> Cancel
                          </button>
                          <button onClick={() => saveEditCalReminder(r.id)} disabled={!editCalTitle.trim() || editCalSaving}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-[#B48B40] hover:bg-[#c99840] disabled:opacity-50 rounded-lg px-2.5 py-1 transition-all">
                            {editCalSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />} Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 group">
                      <button onClick={() => toggleCalendarReminder(r.id, !r.done)} className="shrink-0" aria-label="Toggle client calendar reminder">
                        {r.done
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400/80" strokeWidth={2} />
                          : <span className="block w-4 h-4 rounded-full border border-amber-300/35" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm leading-snug", r.done ? "text-white/35 line-through" : "text-white/85")}>{r.title}</p>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {new Date(r.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <button onClick={() => startEditCalReminder(r)} className="text-white/25 hover:text-[#B48B40] opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Edit client calendar reminder">
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
                      </button>
                      <button onClick={() => deleteCalendarReminder(r.id)} className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Delete client calendar reminder">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                      </button>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/30 px-1 mb-6">No client-visible calendar reminders yet.</p>
            )}

            {/* Private follow-ups — private to you (the trainer), never shown to the client */}
            <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Private follow-ups
              <span className="text-[10px] font-normal text-white/30">· private to you</span>
            </h2>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 mb-3">
              <input
                value={reminderDraft}
                onChange={(e) => setReminderDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addReminder(); }}
                placeholder="Add a reminder — e.g. check in on her knee, send new macros…"
                className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
              />
              <div className="flex items-center justify-between gap-2 mt-2">
                <input
                  type="date"
                  value={reminderDue}
                  onChange={(e) => setReminderDue(e.target.value)}
                  className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]"
                />
                <button
                  onClick={addReminder}
                  disabled={!reminderDraft.trim() || reminderSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
                >
                  {reminderSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
                  Add
                </button>
              </div>
            </div>
            {reminders.length > 0 && (
              <div className="space-y-1.5 mb-6">
                {reminders.map((r) => (
                  editRemId === r.id ? (
                    <div key={r.id} className="rounded-xl border border-[#B48B40]/30 bg-white/[0.03] px-3 py-2.5">
                      <input
                        value={editRemBody}
                        onChange={(e) => setEditRemBody(e.target.value)}
                        autoFocus
                        className="w-full bg-transparent text-sm text-white/90 placeholder:text-white/25 outline-none px-1"
                      />
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <input type="date" value={editRemDue} onChange={(e) => setEditRemDue(e.target.value)}
                          className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none [color-scheme:dark]" />
                        <div className="flex items-center gap-2">
                          <button onClick={cancelEditReminder} className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1 transition-colors">
                            <X className="w-3 h-3" strokeWidth={2} /> Cancel
                          </button>
                          <button onClick={() => saveEditReminder(r.id)} disabled={!editRemBody.trim() || editRemSaving}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-[#B48B40] hover:bg-[#c99840] disabled:opacity-50 rounded-lg px-2.5 py-1 transition-all">
                            {editRemSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />} Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 group">
                      <button onClick={() => toggleReminder(r.id, !r.done)} className="shrink-0" aria-label="Toggle done">
                        {r.done
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-400/80" strokeWidth={2} />
                          : <span className="block w-4 h-4 rounded-full border border-white/25" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm leading-snug", r.done ? "text-white/35 line-through" : "text-white/85")}>{r.body}</p>
                        {r.due_date && (
                          <p className="text-[10px] text-white/30 mt-0.5">
                            Due {new Date(r.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                      <button onClick={() => startEditReminder(r)} className="text-white/25 hover:text-[#B48B40] opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Edit reminder">
                        <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
                      </button>
                      <button onClick={() => deleteReminder(r.id)} className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all shrink-0" aria-label="Delete reminder">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                      </button>
                    </div>
                  )
                ))}
              </div>
            )}

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
              <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shareNew}
                    onChange={(e) => setShareNew(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/15 bg-white/[0.04] accent-[#B48B40]"
                  />
                  <span className="text-[11px] text-white/45">Share with client (sends a notification)</span>
                </label>
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
                    {editingNoteId === n.id ? (
                      <div>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          autoFocus
                          className="w-full resize-y bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <button
                            onClick={cancelEditNote}
                            className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/70 border border-white/10 rounded-lg px-2.5 py-1 transition-colors"
                          >
                            <X className="w-3 h-3" strokeWidth={2} /> Cancel
                          </button>
                          <button
                            onClick={() => saveEditNote(n.id)}
                            disabled={!editDraft.trim() || editSaving}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-[#B48B40] hover:bg-[#c99840] disabled:opacity-50 rounded-lg px-2.5 py-1 transition-all"
                          >
                            {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" strokeWidth={2.5} />} Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className="text-[10px] text-white/30">
                            {n.author_name ?? "Coach"} · {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {n.shared_with_client ? (
                              <button
                                onClick={() => toggleShareNote(n.id, false)}
                                className="text-[9px] uppercase tracking-wider text-emerald-400/70 border border-emerald-400/20 bg-emerald-400/8 rounded px-1.5 py-0.5 hover:border-emerald-400/40"
                                title="Shared with client — click to make private"
                              >
                                Shared
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleShareNote(n.id, true)}
                                className="text-[9px] uppercase tracking-wider text-white/35 hover:text-[#B48B40] border border-white/10 rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-all"
                                title="Share with client (sends a notification)"
                              >
                                Share
                              </button>
                            )}
                            <button
                              onClick={() => startEditNote(n)}
                              className="text-white/25 hover:text-[#B48B40] transition-colors opacity-0 group-hover:opacity-100"
                              aria-label="Edit note"
                            >
                              <Pencil className="w-3.5 h-3.5" strokeWidth={1.7} />
                            </button>
                            <button
                              onClick={() => deleteNote(n.id)}
                              className={cn("text-white/25 hover:text-red-300/80 transition-colors opacity-0 group-hover:opacity-100")}
                              aria-label="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
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
            <NutritionSnapshot n={nutrition} activity={activitySummary} loading={nutritionLoading} weightLogs={weightLogs} unitSystem={unitSystem} />
            {nutrition?.energy && (
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <EnergyCard
                  energy={nutrition.energy}
                  goalMode={
                    clientApproach?.goalMode
                    ?? goalModeFromIntake(intake?.primaryGoal as string | undefined)
                    ?? undefined
                  }
                />
                <ApproachSummary approach={clientApproach} />
              </div>
            )}
            <ClientNutritionManager
              clientId={id}
              clientName={name}
              computedTargets={nutrition?.targets ?? null}
            />

            {nutritionLoading ? (
              <div className="flex items-center justify-center py-12 text-white/40 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading nutrition…
              </div>
            ) : nutritionError ? (
              <p className="text-xs text-red-300/80 px-1">{nutritionError}</p>
            ) : !nutrition || nutrition.totalMeals14 === 0 ? (
              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-10 text-center">
                <Apple className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55 mb-1">No meals logged in the last 14 days</p>
                <p className="text-xs text-white/30">Once {name} logs meals, their intake and trends show here.</p>
              </div>
            ) : (
              <div className="mt-4"><NutritionPanel n={nutrition} /></div>
            )}
          </div>
        )}

        {/* ── Progress tab ── */}
        {tab === "progress" && (
          <ProgressTab
            activity={activitySummary}
            activityLoading={activityLoading}
            unitSystem={unitSystem}
            weightLogs={weightLogs}
            photos={photos}
            loading={progressLoading}
            error={progressError}
            weightDraft={weightDraft}
            weightDate={weightDate}
            weightNote={weightNote}
            weightSaving={weightSaving}
            selectedWeightId={selectedWeightId}
            photoFile={photoFile}
            photoCaption={photoCaption}
            photoDate={photoDate}
            photoUploading={photoUploading}
            photoInputKey={photoInputKey}
            onWeightDraft={setWeightDraft}
            onWeightDate={setWeightDate}
            onWeightNote={setWeightNote}
            onAddWeight={addWeightLog}
            onDeleteWeight={deleteWeightLog}
            onSelectWeight={setSelectedWeightId}
            onPhotoFile={setPhotoFile}
            onPhotoCaption={setPhotoCaption}
            onPhotoDate={setPhotoDate}
            onUploadPhoto={uploadPhoto}
            onDeletePhoto={deletePhoto}
          />
        )}
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

type EngagementData = {
  learn: { done: number; total: number; byCategory: { id: string; label: string; done: number; total: number }[] };
  tasks?: { done: number; open: number; overdue: number };
  activeDays30: number;
  lastSeenAt: string | null;
  lastSignInAt: string | null;
  joinedAt: string | null;
};

// Coach view: how engaged the client is — Learn progress (overall + per
// category) and login frequency (last seen, active days in the last 30).
function EngagementCard({ data }: { data: EngagementData | null }) {
  if (!data) return null;
  const { learn } = data;
  const pct = learn.total > 0 ? Math.round((learn.done / learn.total) * 100) : 0;
  const ago = (iso: string | null) => {
    if (!iso) return "—";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="no-print mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-3 flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-[#B48B40]/80" strokeWidth={1.8} /> Engagement &amp; learning
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile label="Last seen" value={ago(data.lastSeenAt ?? data.lastSignInAt)} />
        <StatTile label="Active days / 30" value={String(data.activeDays30)} />
        <StatTile label="Tasks" value={data.tasks ? `${data.tasks.done} done · ${data.tasks.open} open` : "—"} />
      </div>
      {data.tasks && data.tasks.overdue > 0 && (
        <p className="text-[11px] text-amber-300/80 mb-3 -mt-1">{data.tasks.overdue} task{data.tasks.overdue === 1 ? "" : "s"} overdue</p>
      )}
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-xs font-medium text-white/60">Learning progress</p>
        <p className="text-[11px] text-white/45 tabular-nums">{learn.done}/{learn.total} · {pct}%</p>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-3">
        <div className="h-full bg-[#B48B40] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {learn.byCategory.map((c) => (
          <span key={c.id} className="text-[11px] rounded-lg bg-black/15 border border-white/[0.06] px-2 py-1 text-white/55">
            {c.label} <span className={cn("tabular-nums", c.done === c.total && c.total > 0 ? "text-emerald-400/80" : "text-white/40")}>{c.done}/{c.total}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Compact vitals strip at the top of Overview: the numbers a coach wants at a
// glance. Reads from both the top-level intake (onboarding body-stats step) and
// the `deep` block (trainer pre-fill / deep intake), whichever is present.
function ClientVitals({ intake }: { intake: RawIntake | null }) {
  const deep = (intake?.deep ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim()) || (typeof v === "number" ? String(v) : "");

  const age = str(intake?.age) || str(deep.age);
  const sex = str(intake?.sex) || str(deep.sex);

  const topWeight = str(intake?.weight);
  const weight = topWeight
    ? `${topWeight}${str(intake?.weightUnit) ? ` ${str(intake?.weightUnit)}` : ""}`
    : (deep.weightKg != null ? weightLabel(deep.weightKg) : "");

  const topHeight = str(intake?.height);
  const height = topHeight
    ? `${topHeight}${str(intake?.heightUnit) ? ` ${str(intake?.heightUnit)}` : ""}`
    : (deep.heightCm != null ? heightLabel(deep.heightCm) : "");

  const bodyFat = intake?.bodyFat != null ? `${str(intake?.bodyFat)}%` : (deep.bodyFatPct != null ? `${str(deep.bodyFatPct)}%` : "");
  const goalWeight = deep.goalWeightKg != null ? weightLabel(deep.goalWeightKg) : "";

  const tiles = [
    { label: "Age", value: age },
    { label: "Sex", value: sex, capitalize: true },
    { label: "Weight", value: weight },
    { label: "Height", value: height },
    { label: "Body fat", value: bodyFat },
    { label: "Goal weight", value: goalWeight },
  ].filter((t) => t.value);

  if (tiles.length === 0) return null;

  return (
    <div className="no-print mb-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2 px-1 flex items-center gap-1.5">
        <User className="w-3 h-3 text-[#B48B40]/80" strokeWidth={1.8} /> Client info
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} capitalize={t.capitalize} />)}
      </div>
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

function ProgramSnapshot({
  activity,
  program,
  loading,
}: {
  activity: ActivitySummary | null;
  program: ClientProgram;
  loading: boolean;
}) {
  const target = program?.weekly_training_days ?? null;
  const thisWeek = activity?.thisWeek ?? 0;
  const adherence = target ? Math.min(100, Math.round((thisWeek / target) * 100)) : null;

  return (
    <SnapshotGrid
      className="mb-5"
      items={[
        {
          icon: Activity,
          label: "This week",
          value: loading && !activity ? "…" : target ? `${thisWeek}/${target}` : String(thisWeek),
          detail: target ? `${adherence}% target` : "sessions",
        },
        {
          icon: CalendarDays,
          label: "Last activity",
          value: loading && !activity ? "…" : activity?.lastActivityAt ? formatShortDate(activity.lastActivityAt) : "None",
          detail: activity?.last7 ? `${activity.last7} in 7 days` : "no recent logs",
        },
        {
          icon: TrendingUp,
          label: "30-day volume",
          value: loading && !activity ? "…" : String(activity?.last30 ?? 0),
          detail: "sessions logged",
        },
      ]}
    />
  );
}

function NutritionSnapshot({
  n,
  activity,
  loading,
  weightLogs,
  unitSystem,
}: {
  n: NutritionSummary | null;
  activity: ActivitySummary | null;
  loading: boolean;
  weightLogs: WeightLog[];
  unitSystem: UnitSystem;
}) {
  const previousLogged = n?.days.slice(0, 7).filter((d) => d.meals > 0) ?? [];
  const previousAvg = previousLogged.length
    ? Math.round(previousLogged.reduce((sum, d) => sum + d.calories, 0) / previousLogged.length)
    : 0;
  const calorieDelta = n && previousAvg > 0 ? n.avg.calories - previousAvg : null;
  const latestMeal = n?.recentMeals[0]?.logged_at ?? null;

  const unit = weightUnitLabel(unitSystem);
  const latestW = weightLogs[weightLogs.length - 1] ?? null;
  const prevW = weightLogs.length > 1 ? weightLogs[weightLogs.length - 2] : null;
  const wDelta = latestW && prevW ? Number(latestW.weight_kg) - Number(prevW.weight_kg) : null;

  return (
    <SnapshotGrid
      className="mb-5 sm:grid-cols-2 lg:grid-cols-4"
      items={[
        {
          icon: Scale,
          label: "Bodyweight",
          value: latestW ? `${kgToDisplayUnit(Number(latestW.weight_kg), unitSystem).toFixed(1)} ${unit}` : "None",
          detail: wDelta == null ? "latest log" : `${wDelta >= 0 ? "+" : ""}${kgToDisplayUnit(wDelta, unitSystem).toFixed(1)} ${unit} vs prior`,
        },
        {
          icon: Apple,
          label: "Logged days",
          value: loading && !n ? "…" : `${n?.daysLogged7 ?? 0}/7`,
          detail: `${n?.totalMeals14 ?? 0} meals in 14 days`,
        },
        {
          icon: TrendingUp,
          label: "Calories",
          value: loading && !n ? "…" : `${n?.avg.calories ?? 0}`,
          detail: calorieDelta == null ? "7-day avg" : `${calorieDelta >= 0 ? "+" : ""}${calorieDelta} vs prior`,
        },
        {
          icon: Activity,
          label: "Training context",
          value: String(activity?.last7 ?? 0),
          detail: latestMeal ? `last meal ${formatShortDate(latestMeal)}` : "sessions in 7 days",
        },
      ]}
    />
  );
}

function ProgressSnapshot({
  activity,
  weightLogs,
  photos,
  loading,
  unitSystem,
}: {
  activity: ActivitySummary | null;
  weightLogs: WeightLog[];
  photos: ProgressPhoto[];
  loading: boolean;
  unitSystem: UnitSystem;
}) {
  const unit = weightUnitLabel(unitSystem);
  const latest = weightLogs[weightLogs.length - 1] ?? null;
  const previous = weightLogs.length > 1 ? weightLogs[weightLogs.length - 2] : null;
  const delta = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : null;
  const lastPhoto = photos[0] ?? null;

  return (
    <SnapshotGrid
      className="mb-5"
      items={[
        {
          icon: Scale,
          label: "Bodyweight",
          value: loading && !latest ? "…" : latest ? `${kgToDisplayUnit(Number(latest.weight_kg), unitSystem).toFixed(1)} ${unit}` : "None",
          detail: delta == null ? "latest log" : `${delta >= 0 ? "+" : ""}${kgToDisplayUnit(delta, unitSystem).toFixed(1)} ${unit}`,
        },
        {
          icon: Camera,
          label: "Photos",
          value: loading ? "…" : String(photos.length),
          detail: lastPhoto ? `last ${formatShortDate(lastPhoto.taken_at)}` : "none uploaded",
        },
        {
          icon: Activity,
          label: "Consistency",
          value: String(activity?.currentStreak ?? 0),
          detail: "day training streak",
        },
      ]}
    />
  );
}

function SnapshotGrid({
  items,
  className,
}: {
  items: { icon: typeof User; label: string; value: string; detail: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-2.5", className)}>
      {items.map(({ icon: Icon, label, value, detail }) => (
        <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 mb-1 flex items-center gap-1.5">
            <Icon className="w-3 h-3 text-[#B48B40]/80" strokeWidth={1.8} /> {label}
          </p>
          <p className="text-sm font-semibold text-white/90">{value}</p>
          <p className="text-[11px] text-white/35 mt-0.5">{detail}</p>
        </div>
      ))}
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

function ProgressTab({
  activity,
  activityLoading,
  unitSystem,
  weightLogs,
  photos,
  loading,
  error,
  weightDraft,
  weightDate,
  weightNote,
  weightSaving,
  selectedWeightId,
  photoFile,
  photoCaption,
  photoDate,
  photoUploading,
  photoInputKey,
  onWeightDraft,
  onWeightDate,
  onWeightNote,
  onAddWeight,
  onDeleteWeight,
  onSelectWeight,
  onPhotoFile,
  onPhotoCaption,
  onPhotoDate,
  onUploadPhoto,
  onDeletePhoto,
}: {
  activity: ActivitySummary | null;
  activityLoading: boolean;
  unitSystem: UnitSystem;
  weightLogs: WeightLog[];
  photos: ProgressPhoto[];
  loading: boolean;
  error: string | null;
  weightDraft: string;
  weightDate: string;
  weightNote: string;
  weightSaving: boolean;
  selectedWeightId: string | null;
  photoFile: File | null;
  photoCaption: string;
  photoDate: string;
  photoUploading: boolean;
  photoInputKey: number;
  onWeightDraft: (value: string) => void;
  onWeightDate: (value: string) => void;
  onWeightNote: (value: string) => void;
  onAddWeight: () => void;
  onDeleteWeight: (id: string) => void;
  onSelectWeight: (id: string | null) => void;
  onPhotoFile: (file: File | null) => void;
  onPhotoCaption: (value: string) => void;
  onPhotoDate: (value: string) => void;
  onUploadPhoto: () => void;
  onDeletePhoto: (id: string) => void;
}) {
  const unit = weightUnitLabel(unitSystem);
  const selectedWeight =
    weightLogs.find((log) => log.id === selectedWeightId)
    ?? weightLogs[weightLogs.length - 1]
    ?? null;
  const canSaveWeight = Number(weightDraft) > 0 && !!weightDate && !weightSaving;

  return (
    <div className="no-print">
      <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
        <LineChart className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Progress
      </h2>

      <ProgressSnapshot
        activity={activity}
        weightLogs={weightLogs}
        photos={photos}
        loading={loading || activityLoading}
        unitSystem={unitSystem}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-red-400/15 bg-red-400/8 px-3 py-2 text-xs text-red-200/80">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading progress…
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Bodyweight
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">{weightLogs.length} log{weightLogs.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-2 mb-3">
              <input
                value={weightDraft}
                onChange={(e) => onWeightDraft(e.target.value)}
                type="number"
                min="1"
                step="0.1"
                inputMode="decimal"
                placeholder={`Weight ${unit}`}
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <input
                value={weightDate}
                onChange={(e) => onWeightDate(e.target.value)}
                type="date"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 mb-5">
              <input
                value={weightNote}
                onChange={(e) => onWeightNote(e.target.value)}
                placeholder="Note"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <button
                onClick={onAddWeight}
                disabled={!canSaveWeight}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
              >
                {weightSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" strokeWidth={2} />}
                Add log
              </button>
            </div>

            <WeightChart logs={weightLogs} selectedId={selectedWeight?.id ?? null} onSelect={onSelectWeight} unitSystem={unitSystem} />

            {selectedWeight && (
              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white/85">
                    {kgToDisplayUnit(Number(selectedWeight.weight_kg), unitSystem).toFixed(1)} {unit}
                    <span className="text-xs font-normal text-white/35"> · {formatFullDate(selectedWeight.logged_at)}</span>
                  </p>
                  {selectedWeight.note && <p className="text-xs text-white/50 mt-1 leading-relaxed">{selectedWeight.note}</p>}
                </div>
                <button
                  onClick={() => onDeleteWeight(selectedWeight.id)}
                  className="text-white/25 hover:text-red-300/80 transition-colors"
                  aria-label="Delete weight log"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-white/85 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#B48B40]" strokeWidth={1.8} /> Progress photos
                </p>
                <p className="text-[11px] text-white/35 mt-0.5">Private files · signed previews</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] gap-2 mb-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/60 hover:border-white/20 transition-colors">
                <Upload className="w-4 h-4 text-white/35" strokeWidth={1.8} />
                <span className="truncate">{photoFile ? photoFile.name : "Upload image"}</span>
                <input
                  key={photoInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="sr-only"
                  onChange={(e) => onPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <input
                value={photoDate}
                onChange={(e) => onPhotoDate(e.target.value)}
                type="date"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/75 outline-none focus:border-[#B48B40]/50 [color-scheme:dark]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 mb-5">
              <input
                value={photoCaption}
                onChange={(e) => onPhotoCaption(e.target.value)}
                placeholder="Caption"
                className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-[#B48B40]/50"
              />
              <button
                onClick={onUploadPhoto}
                disabled={!photoFile || photoUploading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B48B40] text-black px-3.5 py-2 text-xs font-semibold hover:bg-[#c99840] disabled:opacity-50 transition-all"
              >
                {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" strokeWidth={2} />}
                Add photo
              </button>
            </div>

            {photos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-black/10 px-5 py-8 text-center">
                <ImageIcon className="w-7 h-7 text-white/15 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/55">No progress photos yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {photos.map((photo) => (
                  <div key={photo.id} className="group overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                    <div className="aspect-[4/5] bg-white/[0.03]">
                      {photo.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.signed_url} alt={photo.caption ?? "Progress photo"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/25">
                          <ImageIcon className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-white/35">{formatFullDate(photo.taken_at)}</p>
                        <button
                          onClick={() => onDeletePhoto(photo.id)}
                          className="text-white/25 hover:text-red-300/80 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label="Delete progress photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                        </button>
                      </div>
                      {photo.caption && <p className="text-xs text-white/65 mt-1 truncate">{photo.caption}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function WeightChart({
  logs,
  selectedId,
  onSelect,
  unitSystem,
}: {
  logs: WeightLog[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  unitSystem: UnitSystem;
}) {
  const unit = weightUnitLabel(unitSystem);
  const disp = (kg: number | string) => kgToDisplayUnit(Number(kg), unitSystem);
  if (logs.length === 0) {
    return (
      <div className="h-44 rounded-2xl border border-dashed border-white/[0.08] bg-black/10 flex flex-col items-center justify-center text-center">
        <Scale className="w-7 h-7 text-white/15 mb-3" strokeWidth={1.5} />
        <p className="text-sm text-white/55">No bodyweight logs yet</p>
      </div>
    );
  }

  const values = logs.map((log) => disp(log.weight_kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 360;
  const height = 168;
  const pad = { top: 18, right: 18, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const points = logs.map((log, index) => {
    const x = pad.left + (logs.length === 1 ? chartW / 2 : (index / (logs.length - 1)) * chartW);
    const y = pad.top + ((max - disp(log.weight_kg)) / span) * chartH;
    return { log, x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/15 px-2 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible">
        <line x1={pad.left} x2={width - pad.right} y1={pad.top} y2={pad.top} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH / 2} y2={pad.top + chartH / 2} className="stroke-white/5" />
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + chartH} y2={pad.top + chartH} className="stroke-white/5" />
        <text x={8} y={pad.top + 4} className="fill-white/30 text-[10px]">{max.toFixed(1)}</text>
        <text x={8} y={pad.top + chartH + 4} className="fill-white/30 text-[10px]">{min.toFixed(1)}</text>
        {logs.length > 1 && <path d={path} fill="none" className="stroke-[#B48B40]" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map(({ log, x, y }) => {
          const selected = selectedId === log.id;
          return (
            <circle
              key={log.id}
              cx={x}
              cy={y}
              r={selected ? 5.5 : 4}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(log.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(log.id);
              }}
              className={cn(
                "cursor-pointer stroke-[#0A0A0A] transition-all",
                selected ? "fill-[#F0C66E]" : "fill-[#B48B40] hover:fill-[#F0C66E]",
              )}
              strokeWidth={2}
            >
              <title>{`${formatFullDate(log.logged_at)} · ${disp(log.weight_kg).toFixed(1)} ${unit}`}</title>
            </circle>
          );
        })}
        {points.length > 0 && (
          <>
            <text x={pad.left} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[0].log.logged_at)}</text>
            <text x={width - pad.right - 44} y={height - 8} className="fill-white/30 text-[10px]">{formatShortDate(points[points.length - 1].log.logged_at)}</text>
          </>
        )}
      </svg>
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
