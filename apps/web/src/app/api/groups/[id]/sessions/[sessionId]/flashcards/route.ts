import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
type Params = Promise<{ id: string; sessionId: string }>;
export async function GET(_request: Request, { params }: { params: Params }) {
  const { id: groupId, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  // Verify user is a group member
  const { data: membership } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return err("Not a group member", 403);
  // Get session — check both note_id and group_note_id
  const { data: session } = await admin
    .from("study_sessions")
    .select("note_id, group_note_id")
    .eq("id", sessionId)
    .single();
  if (!session) return err("Session not found", 404);

  let flashcards;
  if (session.group_note_id) {
    // Group note — fetch by group_note_id
    const { data } = await admin
      .from("flashcards")
      .select("id, question, answer, created_at")
      .eq("group_note_id", session.group_note_id)
      .order("created_at", { ascending: true });
    flashcards = data;
  } else if (session.note_id) {
    // Personal note — fetch by note_id
    const { data } = await admin
      .from("flashcards")
      .select("id, question, answer, created_at")
      .eq("note_id", session.note_id)
      .order("created_at", { ascending: true });
    flashcards = data;
  } else {
    return err("Session has no associated note", 404);
  }

  return ok({ flashcards: flashcards ?? [] });
}
