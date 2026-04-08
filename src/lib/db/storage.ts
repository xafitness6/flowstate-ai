// ─── Supabase Storage — avatar upload ─────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";

const BUCKET = "avatars";

/**
 * Upload a profile image and return the public URL.
 * Path is scoped to the user: avatars/{userId}/avatar.{ext}
 */
export async function uploadAvatar(
  userId: string,
  file:   File,
): Promise<string | null> {
  const supabase = createClient();
  const ext  = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  // upsert = replace existing avatar
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("[storage] upload:", uploadError.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // Persist the URL on the profile row
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (profileError) console.error("[storage] updateProfile:", profileError.message);

  return publicUrl;
}

/** Delete a user's avatar. */
export async function deleteAvatar(userId: string): Promise<void> {
  const supabase = createClient();
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(userId);

  if (files && files.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(files.map((f) => `${userId}/${f.name}`));
  }

  await supabase
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/** Get the public avatar URL for any user (no auth needed, bucket is public). */
export function getAvatarUrl(userId: string, ext = "jpg"): string {
  const supabase = createClient();
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(`${userId}/avatar.${ext}`);
  return data.publicUrl;
}
