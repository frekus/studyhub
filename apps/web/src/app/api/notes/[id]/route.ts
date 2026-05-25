import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, NOTE_TTL } from "@/lib/cache";
import type { StudyNoteRow } from "@studyhub/database";

const UpdateNoteSchema = z
  .object({
    title:     z.string().min(1).max(500).optional(),
    content:   z.string().optional(),
    folder_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => d.title !== undefined || d.content !== undefined || d.folder_id !== undefined,
    { message: "At least one of title, content, or folder_id must be provided" },
  );

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const singleKey = cacheKeys.noteSingle(user.id, id);
  const nocache = new URL(request.url).searchParams.get("nocache") === "1";

  if (!nocache) {
    const cached = await tryGet<{ note: StudyNoteRow }>(singleKey);
    if (cached) {
      const response = ok(cached);
      response.headers.set("X-Cache", "HIT");
      return response;
    }
  }

  const { data: note, error } = await supabase
    .from("study_notes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error?.code === "PGRST116") return err("Note not found", 404);
  if (error) return err(error.message, 500);
  if (!note) return err("Note not found", 404);

  await trySet(singleKey, { note }, NOTE_TTL);

  const response = ok({ note });
  response.headers.set("X-Cache", "MISS");
  return response;
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const parsed = UpdateNoteSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: note, error } = await supabase
    .from("study_notes")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error?.code === "PGRST116") return err("Note not found", 404);
  if (error) return err(error.message, 500);
  if (!note) return err("Note not found", 404);

  await tryDel(
    cacheKeys.noteSingle(user.id, id),
    cacheKeys.notesList(user.id),
  );

  return ok({ note });
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { data: deleted, error } = await supabase
    .from("study_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error?.code === "PGRST116") return err("Note not found", 404);
  if (error) return err(error.message, 500);
  if (!deleted) return err("Note not found", 404);

  await tryDel(
    cacheKeys.noteSingle(user.id, id),
    cacheKeys.notesList(user.id),
  );

  return ok({ success: true });
}
