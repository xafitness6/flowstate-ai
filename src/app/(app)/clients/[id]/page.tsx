"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Download, Loader2, Trash2, StickyNote, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { IntakeReadout } from "@/components/intake/IntakeReadout";
import type { RawIntake } from "@/lib/intake/format";

type ClientProfile = {
  id: string; full_name: string | null; first_name: string | null; last_name: string | null;
  email: string | null; role: string; plan: string;
  assigned_trainer_name: string | null;
};
type Note = { id: string; body: string; author_name: string | null; created_at: string };

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [intake,  setIntake]  = useState<RawIntake | null>(null);
  const [notes,   setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [intakeRes, notesRes] = await Promise.all([
        fetch(`/api/clients/${id}/intake`, { cache: "no-store" }),
        fetch(`/api/clients/${id}/notes`,  { cache: "no-store" }),
      ]);
      const intakeJson = await intakeRes.json();
      if (!intakeRes.ok) throw new Error(intakeJson.error ?? "Couldn't load this client.");
      setProfile(intakeJson.profile);
      setIntake(intakeJson.intake ?? null);
      const notesJson = await notesRes.json();
      if (notesRes.ok) setNotes(notesJson.notes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);

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

        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35 mb-1.5">Client</p>
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

        {/* Printable region: intake */}
        <div id="print-area">
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-semibold">{name} — Onboarding intake</h2>
            <p className="text-xs text-white/50">{profile?.email}</p>
          </div>
          <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">Onboarding intake</h2>
          <IntakeReadout intake={intake} />
        </div>

        {/* Notes */}
        <div className="no-print mt-8">
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
      </div>
    </div>
  );
}
