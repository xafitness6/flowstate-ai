// GET  /api/me/meal-plan/images — signed URLs for the user's active-plan dishes
//      (cached images only).
// POST /api/me/meal-plan/images — for the user's OWN self-built plan: generates
//      ONE missing dish image per call (keyed by dish composition, shared across
//      everyone) so a member's plan gets the same imagery as a trainer-set one.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import OpenAI from "openai";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { dishKey, dishLabel } from "@/lib/nutrition/dishKey";
import { rateLimit } from "@/lib/server/security";

const BUCKET = "meal-images";
const SIGNED_TTL = 60 * 60;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pathFor = (key: string) => `${createHash("sha1").update(key).digest("hex")}.png`;

type Meal = { name?: string | null; items?: { food?: string | null }[] | null };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ images: {} }, { status: 401 });

  const { data: planRow } = await supabase
    .from("meal_plans")
    .select("plan")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!planRow) return NextResponse.json({ images: {} });

  const meals = (((planRow.plan as { meals?: Meal[] })?.meals) ?? []) as Meal[];
  const keys = Array.from(new Set(meals.map((m) => dishKey(m))));
  if (keys.length === 0) return NextResponse.json({ images: {} });

  const admin = await createAdminClient();
  const { data: rows } = await admin.from("meal_images").select("dish_key,storage_path").in("dish_key", keys);

  const images: Record<string, string> = {};
  for (const r of rows ?? []) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(r.storage_path as string, SIGNED_TTL);
    if (signed?.signedUrl) images[r.dish_key as string] = signed.signedUrl;
  }
  return NextResponse.json({ images });
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ images: {}, remaining: 0 }, { status: 401 });
  // Image generation is expensive; tight per-user cap on top of the dish-key cache.
  const limited = rateLimit(`meal-plan-image:${user.id}`, { limit: 6, windowMs: 60_000 });
  if (limited) return limited;

  const admin = await createAdminClient();
  const { data: planRow } = await supabase
    .from("meal_plans").select("plan").eq("user_id", user.id).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!planRow) return NextResponse.json({ images: {}, remaining: 0 });

  const meals = (((planRow.plan as { meals?: Meal[] })?.meals) ?? []) as Meal[];
  const dishes = new Map<string, Meal>();
  for (const m of meals) { const k = dishKey(m); if (!dishes.has(k)) dishes.set(k, m); }
  const keys = [...dishes.keys()];
  if (keys.length === 0) return NextResponse.json({ images: {}, remaining: 0 });

  const { data: existing } = await admin.from("meal_images").select("dish_key,storage_path").in("dish_key", keys);
  const cached = new Map<string, string>((existing ?? []).map((r) => [r.dish_key as string, r.storage_path as string]));

  const images: Record<string, string> = {};
  for (const [k, path] of cached) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
    if (signed?.signedUrl) images[k] = signed.signedUrl;
  }

  const missing = keys.filter((k) => !cached.has(k));
  if (missing.length > 0 && process.env.OPENAI_API_KEY) {
    const key = missing[0];
    const label = dishLabel(dishes.get(key)!);
    const prompt = `A realistic, appetizing overhead food photograph of a single plated serving of ${label}. Plain white plate, clean neutral background, soft natural lighting, no text, no people, no hands. Professional food photography.`;
    try {
      const gen = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 });
      const b64 = gen.data?.[0]?.b64_json;
      if (b64) {
        const buf = Buffer.from(b64, "base64");
        const path = pathFor(key);
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: "image/png", upsert: true });
        if (!upErr) {
          await admin.from("meal_images").upsert({ dish_key: key, label, prompt, storage_path: path }, { onConflict: "dish_key" });
          const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
          if (signed?.signedUrl) images[key] = signed.signedUrl;
        }
      }
    } catch { /* generation best-effort */ }
  }

  const remaining = keys.filter((k) => !images[k]).length;
  return NextResponse.json({ images, remaining });
}
