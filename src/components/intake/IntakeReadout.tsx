"use client";

import {
  type RawIntake, dash, list, goalLabel, expLabel, timeLabel,
  weightLabel, heightLabel, scaleLabel, hasDeep,
} from "@/lib/intake/format";

const ENERGY_LABEL: Record<string, string> = { low: "Low", steady: "Steady", high: "High", variable: "Up and down" };
const energyValue = (v: unknown) => (typeof v === "string" && ENERGY_LABEL[v]) || "—";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-white/35 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-white/85 text-right leading-relaxed">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <h3 className="text-[10px] uppercase tracking-[0.28em] text-[#B48B40]/70 mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

/** Read-only render of a client's onboarding answers (basic + deep cal). */
export function IntakeReadout({ intake }: { intake: RawIntake | null }) {
  if (!intake || Object.keys(intake).length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-8 text-center">
        <p className="text-sm text-white/45">This client hasn&apos;t completed onboarding yet.</p>
      </div>
    );
  }

  const deep = (intake.deep ?? {}) as Record<string, unknown>;
  const deepDone = hasDeep(intake);

  return (
    <div className="space-y-3">
      <Section title="Snapshot">
        <Row label="Primary goal"   value={goalLabel(intake.primaryGoal)} />
        <Row label="Experience"     value={expLabel(intake.experience)} />
        <Row label="Days / week"    value={dash(intake.daysPerWeek)} />
        <Row label="Session length" value={intake.sessionLength ? `${dash(intake.sessionLength)} min` : "—"} />
        <Row label="Equipment"      value={list(intake.equipment)} />
        <Row label="Main friction"  value={list(intake.mainStruggle)} />
        <Row label="Diet style"     value={list(intake.dietStyle)} />
        <Row label="Meals / day"    value={dash(intake.mealsPerDay)} />
        <Row label="Sleep"          value={intake.sleepHours ? `${dash(intake.sleepHours)} hrs` : "—"} />
        <Row label="Energy"         value={energyValue(intake.energyLevel)} />
      </Section>

      {!deepDone && (
        <div className="rounded-xl border border-[#B48B40]/20 bg-[#B48B40]/[0.05] px-4 py-2.5">
          <p className="text-[11px] text-[#B48B40]/80">Awaiting deep calibration — only the quick intake is filled out.</p>
        </div>
      )}

      {deepDone && (
        <>
          <Section title="Body & history">
            <Row label="Height"        value={heightLabel(deep.heightCm)} />
            <Row label="Weight"        value={weightLabel(deep.weightKg)} />
            <Row label="Goal weight"   value={weightLabel(deep.goalWeightKg)} />
            <Row label="Timeframe"     value={dash(deep.goalTimeframe)} />
            <Row label="Body fat"      value={deep.bodyFatPct == null ? "—" : `${dash(deep.bodyFatPct)}%`} />
            <Row label="Years training" value={dash(deep.trainingYears)} />
            <Row label="Longest streak" value={dash(deep.longestStreak)} />
            <Row label="Best lift"     value={dash(deep.bestLift)} />
            <Row label="Best physique" value={dash(deep.bestPhysique)} />
            <Row label="Injuries"      value={list(deep.injuries)} />
            <Row label="Injury detail" value={dash(deep.injuryDetails)} />
            <Row label="Medications"   value={dash(deep.medications)} />
            <Row label="Conditions"    value={dash(deep.medicalConditions)} />
          </Section>

          <Section title="Goals & motivation">
            <Row label="Why"            value={dash(deep.goalWhy)} />
            <Row label="90-day success" value={dash(deep.successIn90Days)} />
            <Row label="Tried, failed"  value={dash(deep.triedNotWorked)} />
            <Row label="Motivation"     value={dash(deep.motivationStyle)} />
          </Section>

          <Section title="Lifestyle">
            <Row label="Preferred time"  value={dash(deep.preferredTime)} />
            <Row label="Available days"  value={list(deep.availableDays)} />
            <Row label="Travel"          value={dash(deep.travelFrequency)} />
            <Row label="Bedtime"         value={timeLabel(deep.bedTime)} />
            <Row label="Wake time"       value={timeLabel(deep.wakeTime)} />
            <Row label="Stress"          value={scaleLabel(deep.stressLevel)} />
            <Row label="Caffeine"        value={dash(deep.caffeinePattern)} />
            <Row label="Alcohol"         value={dash(deep.alcoholPattern)} />
          </Section>

          <Section title="Nutrition">
            <Row label="Cooking"      value={dash(deep.cookingAbility)} />
            <Row label="Won't eat"    value={dash(deep.foodsHate)} />
            <Row label="Anchor meals" value={dash(deep.foodsAnchor)} />
            <Row label="Eating window" value={
              (deep.eatingStart || deep.eatingEnd)
                ? `${timeLabel(deep.eatingStart)} – ${timeLabel(deep.eatingEnd)}`
                : "—"} />
            <Row label="Treat style"  value={dash(deep.cheatStyle)} />
            <Row label="Supplements"  value={dash(deep.supplements)} />
            <Row label="Hydration"    value={deep.hydrationL ? `${dash(deep.hydrationL)} L/day` : "—"} />
          </Section>

          <Section title="Coaching preferences">
            <Row label="Tone"       value={dash(deep.coachTone)} />
            <Row label="Profanity"  value={dash(deep.profanity)} />
            <Row label="Push level" value={scaleLabel(deep.pushLevel)} />
          </Section>
        </>
      )}
    </div>
  );
}
