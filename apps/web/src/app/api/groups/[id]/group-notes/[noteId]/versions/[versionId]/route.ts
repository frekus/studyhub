import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { tryPublishGroupNoteSummarize } from "@/lib/queue";

type Params = Promise<{ id: string; noteId: string; versionId: string }>;

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin.from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

// Restore a version
export async function POST(request: Request, { params }: { params: Params }) {
  const { id, noteId, versionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: version } = await admin.from("group_note_versions")
    .select("*").eq("id", versionId).eq("group_note_id", noteId).maybeSingle();
  if (!version) return err("Version not found", 404);

  // Save current state as new version first
  const { data: currentNote } = await admin.from("group_notes").select("*")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (!currentNote) return err("Note not found", 404);

  const { data: latest } = await admin.from("group_note_versions")
    .select("version_number").eq("group_note_id", noteId)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latest?.version_number ?? 0) + 1;

  await admin.from("group_note_versions").insert({
    group_note_id: noteId, group_id: id,
    version_number: nextVersion,
    title: currentNote.title, content: currentNote.content,
    edited_by: user.id,
  });

  // Restore the selected version
  const { data: restored, error } = await admin.from("group_notes")
    .update({ title: version.title, content: version.content, last_edited_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", noteId).select().single();
  if (error) return err(error.message, 500);

  void tryPublishGroupNoteSummarize({
    groupNoteId: noteId, groupId: id,
    title: restored.title, content: restored.content,
  });

  return ok({ note: restored });
}
