import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, NOTE_TTL } from "@/lib/cache";
import { tryPublishNoteSummarize } from "@/lib/queue";
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

  // Save a version snapshot before updating (only when title or content changes)
  if (parsed.data.title !== undefined || parsed.data.content !== undefined) {
    const { data: current } = await supabase
      .from("study_notes")
      .select("title, content")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: latest } = await (supabase as any)
        .from("note_versions")
        .select("version_number")
        .eq("note_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVNum = ((latest?.version_number as number | null) ?? 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("note_versions")
        .insert({
          note_id:        id,
          user_id:        user.id,
          version_number: nextVNum,
          title:          current.title,
          content:        current.content,
        });

      // Keep only last 10 versions — delete older ones
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allVersions } = await (supabase as any)
        .from("note_versions")
        .select("id, version_number")
        .eq("note_id", id)
        .order("version_number", { ascending: false });

      if (Array.isArray(allVersions) && allVersions.length > 10) {
        const toDelete = (allVersions as { id: string }[]).slice(10).map((v) => v.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("note_versions")
          .delete()
          .in("id", toDelete);
      }
    }
  }

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

  // Re-queue summarisation whenever title or content changes
  if (parsed.data.title !== undefined || parsed.data.content !== undefined) {
    void tryPublishNoteSummarize({
      noteId: id,
      userId: user.id,
      title:   note.title,
      content: note.content ?? "",
    });
  }

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
