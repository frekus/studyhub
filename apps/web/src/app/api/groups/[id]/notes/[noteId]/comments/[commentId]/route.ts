import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; noteId: string; commentId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id, noteId, commentId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  const { data: comment } = await admin
    .from("note_comments").select("user_id")
    .eq("id", commentId).eq("note_id", noteId).eq("group_id", id).maybeSingle();

  if (!comment) return err("Comment not found", 404);
  if (comment.user_id !== user.id) return err("Not your comment", 403);

  const { error } = await admin.from("note_comments").delete().eq("id", commentId);
  if (error) return err(error.message, 500);

  return ok({ success: true });
}
