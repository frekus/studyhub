import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id: noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Rate limit: 10 flashcard generations per user per hour
  const { rateLimit, rateLimitResponse } = await import("@/lib/rate-limit");
  const { allowed, resetInSeconds } = await rateLimit(
    `flashcards:generate:${user.id}`,
    10,
    60 * 60
  );
  if (!allowed) return rateLimitResponse(resetInSeconds, "You can generate flashcards 10 times per hour.");

  const admin = createAdminClient();

  // Fetch the note to check ownership
  const { data: note } = await admin
    .from("study_notes")
    .select("id, user_id")
    .eq("id", noteId)
    .maybeSingle();

  if (!note) return err("Note not found", 404);

  const isOwner = note.user_id === user.id;

  if (!isOwner) {
    // Check whether this note is shared in any group the current user belongs to.
    // Two-step: get the user's group IDs, then check study_group_notes.
    const { data: memberships } = await supabase
      .from("study_group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const groupIds = (memberships ?? []).map((m) => m.group_id);

    if (groupIds.length === 0) return err("Access denied", 403);

    const { data: sharedNote } = await admin
      .from("study_group_notes")
      .select("id")
      .eq("note_id", noteId)
      .in("group_id", groupIds)
      .limit(1)
      .maybeSingle();

    if (!sharedNote) return err("Access denied", 403);
  }

  // Fetch flashcards using admin client (bypasses user_id RLS)
  const { data: flashcards, error } = await admin
    .from("flashcards")
    .select("id, question, answer, created_at")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error) return err(error.message, 500);

  return ok({ flashcards: flashcards ?? [] });
}
