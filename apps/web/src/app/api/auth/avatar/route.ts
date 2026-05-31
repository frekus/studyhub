import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED   = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error("[avatar POST] auth error:", authError?.message);
    return err("Unauthorized", 401);
  }

  let formData: FormData;
  try { formData = await request.formData(); }
  catch (e) {
    console.error("[avatar POST] formData error:", e);
    return err("Invalid form data", 400);
  }

  const file = formData.get("avatar");
  if (!(file instanceof File)) return err("No file provided", 400);
  if (!ALLOWED.includes(file.type)) return err("Only JPEG, PNG, WebP or GIF allowed", 400);
  if (file.size > MAX_BYTES) return err("File must be under 2MB", 400);

  // Always use same filename regardless of extension to avoid orphaned files
  const path   = `${user.id}/avatar`;
  const buffer = Buffer.from(await file.arrayBuffer());

  console.log("[avatar POST] uploading to path:", path, "type:", file.type, "size:", file.size);

  // First remove any existing avatar files for this user
  const { data: existing } = await supabase.storage
    .from("avatars")
    .list(user.id);

  if (existing && existing.length > 0) {
    const paths = existing.map(f => `${user.id}/${f.name}`);
    console.log("[avatar POST] removing existing:", paths);
    await supabase.storage.from("avatars").remove(paths);
  }

  // Upload fresh
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[avatar POST] upload error:", uploadError.message);
    return err(uploadError.message, 500);
  }

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  const avatarUrl = `${publicUrl}?t=${Date.now()}`;
  console.log("[avatar POST] public URL:", avatarUrl);

  const { error: dbError } = await supabase
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (dbError) {
    console.error("[avatar POST] db error:", dbError.message);
    return err(dbError.message, 500);
  }

  return ok({ avatar_url: avatarUrl });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

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
