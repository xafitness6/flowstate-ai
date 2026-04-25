import { createClient } from "@/lib/supabase/client";

export async function upsertNutritionNote(
  userId: string,
  date: string,
  note: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("nutrition_notes")
    .upsert(
      { user_id: userId, date, note, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );
  if (error) console.error("[nutrition_notes] upsert:", error.message);
}

export async function getNutritionNote(
  userId: string,
  date: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nutrition_notes")
    .select("note")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) { console.error("[nutrition_notes] get:", error.message); return null; }
  return (data as { note: string } | null)?.note ?? null;
}
