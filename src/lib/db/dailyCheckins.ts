import { createClient } from "@/lib/supabase/client";

export type DailyCheckinRow = {
  id: string;
  user_id: string;
  date: string;
  identity_state: string | null;
  energy_note: string | null;
  completed_habits: string[];
  key_done: boolean;
  score: number | null;
  created_at: string;
  updated_at: string;
};

export type DailyCheckinUpsert = {
  identity_state?: string | null;
  energy_note?: string | null;
  completed_habits?: string[];
  key_done?: boolean;
  score?: number | null;
};

export async function upsertDailyCheckin(
  userId: string,
  date: string,
  data: DailyCheckinUpsert,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("daily_checkins")
    .upsert(
      { user_id: userId, date, ...data, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" },
    );
  if (error) console.error("[daily_checkins] upsert:", error.message);
}

export async function getDailyCheckin(
  userId: string,
  date: string,
): Promise<DailyCheckinRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (error) { console.error("[daily_checkins] get:", error.message); return null; }
  return data as DailyCheckinRow | null;
}
