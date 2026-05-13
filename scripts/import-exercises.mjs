// ─── Exercise library importer ───────────────────────────────────────────────
// Downloads the Free Exercise DB (https://github.com/yuhonas/free-exercise-db,
// MIT-licensed) and upserts every exercise into public.exercises.
//
// Adds coaching metadata: joint_load and injury_friendly_for tags inferred
// from the source data so we can filter "knee-safe", "low-impact", etc.
//
// Usage:
//   node scripts/import-exercises.mjs            # full import
//   node scripts/import-exercises.mjs --dry      # parse only, don't write
//
// Re-running is safe — it upserts on the primary key, so re-runs update
// existing rows without creating duplicates.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const BATCH_SIZE = 200;
const DRY        = process.argv.includes("--dry");

// ─── Env loader ──────────────────────────────────────────────────────────────

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url        = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");

if (!DRY && (!url || !serviceKey)) {
  console.error("ERROR: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ─── Coaching metadata heuristics ────────────────────────────────────────────
// Inferred from source columns. Conservative — better to under-tag than mislabel
// an exercise as safe for a joint it actually stresses.

function inferJointLoad(ex) {
  const name = (ex.name ?? "").toLowerCase();
  const cat  = (ex.category ?? "").toLowerCase();
  const force = (ex.force ?? "").toLowerCase();

  if (cat === "stretching" || cat === "stretches" || cat === "mobility") return "low";
  if (cat === "cardio") return "moderate";
  if (cat === "plyometrics" || /jump|hop|bounding|sprint/.test(name)) return "high";
  if (force === "static") return "low";

  // Heavy compound lifts under load
  if (/deadlift|squat|clean|jerk|snatch|press/.test(name) && ex.equipment === "barbell") return "high";

  // Bodyweight + dumbbell + machine — moderate by default
  return "moderate";
}

function inferInjuryFriendly(ex) {
  const tags = new Set();
  const name = (ex.name ?? "").toLowerCase();
  const cat  = (ex.category ?? "").toLowerCase();
  const eq   = (ex.equipment ?? "").toLowerCase();
  const prim = new Set((ex.primaryMuscles ?? []).map((m) => m.toLowerCase()));
  const sec  = new Set((ex.secondaryMuscles ?? []).map((m) => m.toLowerCase()));
  const all  = new Set([...prim, ...sec]);
  const joint = inferJointLoad(ex);

  // Knee-friendly: low-impact, no plyometrics, no heavy axial squats
  const isLeg = ["quadriceps","hamstrings","glutes","calves"].some((m) => all.has(m));
  if (joint !== "high" && cat !== "plyometrics" && !/squat|lunge|jump|sprint/.test(name) && (isLeg || cat === "stretching")) {
    tags.add("knee");
  }

  // Lower-back-friendly: no deadlifts, no loaded spinal flexion
  if (cat !== "plyometrics" && !/deadlift|good morning|bent.over|sit.up|crunch/.test(name) && joint !== "high") {
    if (all.has("glutes") || all.has("abdominals") || cat === "stretching") tags.add("lower_back");
  }

  // Shoulder-friendly: no overhead pressing, no behind-the-neck
  if (!/overhead|behind.the.neck|press/.test(name) || cat === "stretching") {
    if (all.has("shoulders") || cat === "stretching") tags.add("shoulder");
  }

  // Foot/ankle-friendly: bodyweight, machines, anything seated/lying
  if (eq === "machine" || eq === "cable" || /seated|lying|supine|prone/.test(name)) {
    tags.add("foot");
    tags.add("ankle");
  }

  // Hip-friendly: stretching, mobility, light isolation
  if (cat === "stretching" || (cat === "strength" && joint === "low")) tags.add("hip");

  // Walking problems / general mobility-limited: low joint load + no plyo + no jumping
  if (joint === "low" && cat !== "plyometrics" && !/jump|sprint|bound/.test(name)) {
    tags.add("mobility_limited");
  }

  return [...tags];
}

function inferContraindications(ex) {
  const out = [];
  const name = (ex.name ?? "").toLowerCase();
  if (/deadlift|good morning|bent.over.row|romanian/.test(name)) out.push("acute_lower_back");
  if (/jump|sprint|plyo|box jump/.test(name)) out.push("acute_knee_injury", "acute_ankle_sprain");
  if (/overhead|press|snatch|jerk/.test(name)) out.push("acute_shoulder_impingement");
  if (/squat|lunge/.test(name) && ex.equipment === "barbell") out.push("acute_knee_injury");
  return out;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`→ Fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error("Source did not return an array");
    process.exit(1);
  }
  console.log(`→ ${data.length} exercises parsed`);

  const rows = data.map((ex) => ({
    id:                  ex.id,
    name:                ex.name,
    category:            ex.category ?? "strength",
    force:               ex.force ?? null,
    level:               ex.level ?? null,
    mechanic:            ex.mechanic ?? null,
    equipment:           ex.equipment ?? null,
    primary_muscles:     ex.primaryMuscles ?? [],
    secondary_muscles:   ex.secondaryMuscles ?? [],
    instructions:        ex.instructions ?? [],
    images:              (ex.images ?? []).map((p) => `${IMAGE_BASE}${p}`),
    joint_load:          inferJointLoad(ex),
    injury_friendly_for: inferInjuryFriendly(ex),
    contraindications:   inferContraindications(ex),
    source:              "free-exercise-db",
    updated_at:          new Date().toISOString(),
  }));

  // Sanity stats
  const byCat = new Map();
  const byJoint = new Map();
  const kneeSafe = rows.filter((r) => r.injury_friendly_for.includes("knee")).length;
  for (const r of rows) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
    byJoint.set(r.joint_load, (byJoint.get(r.joint_load) ?? 0) + 1);
  }
  console.log("\nCategory breakdown:");
  for (const [k, v] of byCat) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log("\nJoint load breakdown:");
  for (const [k, v] of byJoint) console.log(`  ${k.padEnd(10)} ${v}`);
  console.log(`\nKnee-friendly tagged: ${kneeSafe}`);

  if (DRY) {
    console.log("\n(--dry mode — nothing written)");
    console.log("Sample row:", JSON.stringify(rows[0], null, 2));
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n→ Upserting in batches of ${BATCH_SIZE}…`);
  console.log(`  Target: ${url}`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNo = i / BATCH_SIZE + 1;

    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error } = await supabase.from("exercises").upsert(batch, { onConflict: "id" });
        if (!error) { lastErr = null; break; }
        lastErr = error;
        console.warn(`\n  Batch ${batchNo} attempt ${attempt} failed: ${error.message}`);
      } catch (e) {
        lastErr = e;
        console.warn(`\n  Batch ${batchNo} attempt ${attempt} threw: ${e.message}`);
        if (e.cause) console.warn(`    cause: ${e.cause.code ?? ""} ${e.cause.message ?? e.cause}`);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }

    if (lastErr) {
      console.error(`\n✗ Batch ${batchNo} permanently failed.`);
      if (lastErr.cause) console.error("  cause:", lastErr.cause);
      console.error("\nTroubleshooting:");
      console.error("  1. Check NEXT_PUBLIC_SUPABASE_URL is reachable: curl -I", url);
      console.error("  2. Confirm SUPABASE_SERVICE_ROLE_KEY in .env.local is the service_role key (not anon)");
      console.error("  3. If on a VPN/corporate network, try without it");
      console.error("  4. Node version: node --version  (needs 18+)");
      process.exit(1);
    }
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log(`\n✓ Imported ${rows.length} exercises.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
