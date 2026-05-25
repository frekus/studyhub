import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";
import { tryPublishGroupNoteSummarize } from "@/lib/queue";

type Params = Promise<{ id: string; noteId: string }>;

const UpdateSchema = z.object({
  title:   z.string().min(1).max(500).optional(),
  content: z.string().optional(),
}).refine((d) => d.title !== undefined || d.content !== undefined, {
  message: "At least one field required",
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("group_notes").select("id, group_id, content")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (!existing) return err("Note not found", 404);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: note, error } = await admin
    .from("group_notes")
    .update({ ...parsed.data, last_edited_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", noteId).select().single();
  if (error) return err(error.message, 500);

  // Re-summarize if content changed
  if (parsed.data.content !== undefined && parsed.data.content !== existing.content) {
    void tryPublishGroupNoteSummarize({
      groupNoteId: noteId, groupId: id,
      title: note.title, content: note.content,
    });
  }

  return ok({ note });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Must be creator or group owner
  const [{ data: note }, { data: membership }] = await Promise.all([
    admin.from("group_notes").select("created_by").eq("id", noteId).eq("group_id", id).maybeSingle(),
    admin.from("study_group_members").select("role").eq("group_id", id).eq("user_id", user.id).maybeSingle(),
  ]);

  if (!note) return err("Note not found", 404);
  if (note.created_by !== user.id && membership?.role !== "owner") {
    return err("Permission denied", 403);
  }

  const { error } = await admin.from("group_notes").delete().eq("id", noteId);
  if (error) return err(error.message, 500);

  return ok({ success: true });
}
