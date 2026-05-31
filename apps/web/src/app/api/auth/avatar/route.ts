import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED   = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return err("Invalid form data", 400); }

  const file = formData.get("avatar");
  if (!(file instanceof File)) return err("No file provided", 400);
  if (!ALLOWED.includes(file.type)) return err("Only JPEG, PNG, WebP or GIF allowed", 400);
  if (file.size > MAX_BYTES) return err("File must be under 2MB", 400);

  const ext    = file.type.split("/")[1].replace("jpeg", "jpg");
  const path   = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Try upsert — if it fails because file exists, remove then re-upload
  let uploadError: { message: string } | null = null;

  const { error: upsertErr } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  uploadError = upsertErr;

  // Fallback: remove existing file then upload fresh
  if (uploadError) {
    await supabase.storage.from("avatars").remove([path]);
    const { error: retryErr } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    uploadError = retryErr;
  }

  if (uploadError) {
    console.error("[avatar] upload error:", uploadError.message);
    return err(uploadError.message, 500);
  }

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (dbError) {
    console.error("[avatar] db error:", dbError.message);
    return err(dbError.message, 500);
  }

  return ok({ avatar_url: avatarUrl });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

  // Remove all avatar files for this user
  const { data: files } = await supabase.storage
    .from("avatars")
    .list(user.id);

  if (files && files.length > 0) {
    const paths = files.map(f => `${user.id}/${f.name}`);
    await supabase.storage.from("avatars").remove(paths);
  }

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (dbError) return err(dbError.message, 500);

  return ok({ avatar_url: null });
}
