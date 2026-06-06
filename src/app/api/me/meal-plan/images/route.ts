// GET /api/me/meal-plan/images — signed URLs for the client's active-plan
// dishes. Serves CACHED images only (no generation — that's coach-driven and
// costs money). Returns {} for dishes that haven't been generated yet.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { dishKey } from "@/lib/nutrition/dishKey";

const BUCKET = "meal-images";
const SIGNED_TTL = 60 * 60;

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
