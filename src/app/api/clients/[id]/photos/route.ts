// Progress photos for the trainer hub. Files live in a private Supabase Storage
// bucket; this API returns short-lived signed URLs only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

const BUCKET = "progress-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  taken_at: string;
  created_at: string;
};

function extensionFor(file: File): string {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (file.type && byMime[file.type]) return byMime[file.type];
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "jpg";
}

function normalizeTakenAt(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function withSignedUrl(auth: Awaited<ReturnType<typeof requireClientAccess>> & { ok: true }, row: PhotoRow) {
  const { data, error } = await auth.admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60);

  return {
    id: row.id,
    caption: row.caption,
    taken_at: row.taken_at,
    created_at: row.created_at,
    signed_url: error ? null : data.signedUrl,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("progress_photos")
    .select("id,storage_path,caption,taken_at,created_at")
    .eq("user_id", id)
    .order("taken_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ photos: [], unavailable: true });

  const photos = await Promise.all(((data ?? []) as PhotoRow[]).map((row) => withSignedUrl(auth, row)));
  return NextResponse.json({ photos });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Use JPG, PNG, WebP, HEIC, or HEIF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 8 MB or smaller." }, { status: 400 });
  }

  const captionValue = form.get("caption");
  const caption = typeof captionValue === "string" ? captionValue.trim().slice(0, 500) : "";
  const takenAt = normalizeTakenAt(form.get("taken_at"));
  const storagePath = `${id}/${crypto.randomUUID()}.${extensionFor(file)}`;

  const { error: uploadError } = await auth.admin.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await auth.admin
    .from("progress_photos")
    .insert({
      user_id: id,
      storage_path: storagePath,
      bucket_id: BUCKET,
      caption: caption || null,
      taken_at: takenAt,
    })
    .select("id,storage_path,caption,taken_at,created_at")
    .single();

  if (error) {
    await auth.admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Progress photos are not ready yet. Apply migration 024." }, { status: 503 });
  }

  return NextResponse.json({ photo: await withSignedUrl(auth, data as PhotoRow) });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const photoId = new URL(req.url).searchParams.get("id");
  if (!photoId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: existing } = await auth.admin
    .from("progress_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("user_id", id)
    .maybeSingle();

  const { error } = await auth.admin
    .from("progress_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const path = (existing as { storage_path?: string } | null)?.storage_path;
  if (path) await auth.admin.storage.from(BUCKET).remove([path]);

  return NextResponse.json({ ok: true });
}
