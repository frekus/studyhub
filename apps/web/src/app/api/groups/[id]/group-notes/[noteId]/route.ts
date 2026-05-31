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

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  const { data: note, error } = await admin
    .from("group_notes").select("*")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (error || !note) return err("Note not found", 404);

  // Resolve names
  const userIds = [...new Set([note.created_by, note.last_edited_by].filter(Boolean) as string[])];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", userIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
  }

  return ok({ note: {
    ...note,
    creator_name: nameMap[note.created_by] ?? "Unknown",
    last_editor_name: note.last_edited_by ? (nameMap[note.last_edited_by] ?? "Unknown") : null,
  }});
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("group_notes").select("id, group_id, title, content")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (!existing) return err("Note not found", 404);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  // Save current state as version before updating
  const { data: latest } = await admin.from("group_note_versions")
    .select("version_number").eq("group_note_id", noteId)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latest?.version_number ?? 0) + 1;
  await admin.from("group_note_versions").insert({
    group_note_id: noteId, group_id: id,
    version_number: nextVersion,
    title: existing.title ?? "", content: existing.content,
    edited_by: user.id,
  });

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
