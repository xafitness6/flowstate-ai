// POST /api/clients/[id]/meal-plan/images
// Returns signed image URLs for the dishes in the client's active meal plan.
// Each dish (keyed by its food composition, not the client) is generated ONCE,
// stored in the private "meal-images" bucket, and reused everywhere it appears.
// To bound latency, at most ONE missing image is generated per request; the UI
// polls until `remaining` hits 0. Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import OpenAI from "openai";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { dishKey, dishLabel } from "@/lib/nutrition/dishKey";

const BUCKET = "meal-images";
const SIGNED_TTL = 60 * 60; // 1 hour
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Meal = { name?: string | null; items?: { food?: string | null }[] | null };

const pathFor = (key: string) => `${createHash("sha1").update(key).digest("hex")}.png`;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  // Load the client's active plan and collect its distinct dishes.
  const { data: planRow, error: planErr } = await auth.admin
    .from("meal_plans")
    .select("plan")
    .eq("user_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planErr || !planRow) return NextResponse.json({ images: {}, remaining: 0 });

  const meals = (((planRow.plan as { meals?: Meal[] })?.meals) ?? []) as Meal[];
  const dishes = new Map<string, Meal>();
  for (const m of meals) {
    const k = dishKey(m);
    if (!dishes.has(k)) dishes.set(k, m);
  }
  const keys = [...dishes.keys()];
  if (keys.length === 0) return NextResponse.json({ images: {}, remaining: 0 });

  // Which dishes already have a cached image?
  const { data: existing } = await auth.admin
    .from("meal_images")
    .select("dish_key,storage_path")
    .in("dish_key", keys);
  const cached = new Map<string, string>((existing ?? []).map((r) => [r.dish_key as string, r.storage_path as string]));

  // Sign all cached images.
  const images: Record<string, string> = {};
  for (const [k, path] of cached) {
    const { data: signed } = await auth.admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
    if (signed?.signedUrl) images[k] = signed.signedUrl;
  }

  const missing = keys.filter((k) => !cached.has(k));

  // Generate exactly one missing image this call (latency bound).
  let generationError: string | null = null;
  if (missing.length > 0 && process.env.OPENAI_API_KEY) {
    const key = missing[0];
    const meal = dishes.get(key)!;
    const label = dishLabel(meal);
    const prompt = `A realistic, appetizing overhead food photograph of a single plated serving of ${label}. Plain white plate, clean neutral background, soft natural lighting, no text, no people, no hands. Professional food photography.`;
    try {
      const gen = await client.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 });
      const b64 = gen.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned.");
      const buf = Buffer.from(b64, "base64");
      const path = pathFor(key);
      const { error: upErr } = await auth.admin.storage.from(BUCKET).upload(path, buf, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      await auth.admin.from("meal_images").upsert({ dish_key: key, label, prompt, storage_path: path }, { onConflict: "dish_key" });
      const { data: signed } = await auth.admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      if (signed?.signedUrl) images[key] = signed.signedUrl;
    } catch (e) {
      generationError = e instanceof Error ? e.message : "Image generation failed.";
    }
  }

  const remaining = keys.filter((k) => !images[k]).length;
  return NextResponse.json({ images, remaining, generationError });
}
