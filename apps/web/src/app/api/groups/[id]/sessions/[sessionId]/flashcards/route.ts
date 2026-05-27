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

  // Get session to find note_id
  const { data: session } = await admin
    .from("study_sessions")
    .select("note_id")
    .eq("id", sessionId)
    .single();

  if (!session?.note_id) return err("Session not found", 404);

  // Fetch flashcards using admin client (bypasses RLS — note may belong to the host)
  const { data: flashcards } = await admin
    .from("flashcards")
    .select("id, question, answer, created_at")
    .eq("note_id", session.note_id)
    .order("created_at", { ascending: true });

  return ok({ flashcards: flashcards ?? [] });
}
