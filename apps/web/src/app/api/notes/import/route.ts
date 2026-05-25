import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";
import { tryPublishNoteFlashcards } from "@/lib/queue";

const ImportSchema = z.object({
  noteId: z.string().uuid("noteId must be a valid UUID"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const admin = createAdminClient();

  // Security: the note must be shared in a group the requesting user belongs to
  const { data: sharedEntry } = await admin
    .from("study_group_notes")
    .select("id, group_id, study_notes(id, title, content, ai_summary)")
    .eq("note_id", parsed.data.noteId)
    .maybeSingle();

  if (!sharedEntry) {
    return err("Note not found or not shared in any group", 404);
  }

  const { data: membership } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", sharedEntry.group_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return err("Access denied: you are not a member of the group this note belongs to", 403);
  }

  const sn = Array.isArray(sharedEntry.study_notes)
    ? sharedEntry.study_notes[0]
    : sharedEntry.study_notes;
  if (!sn) return err("Note content not found", 404);

  // Create the imported copy in the user's own notes
  const { data: newNote, error } = await supabase
    .from("study_notes")
    .insert({
      user_id: user.id,
      title: `${sn.title} (imported)`,
      content: sn.content ?? "",
      ai_summary: sn.ai_summary,
    })
    .select()
    .single();

  if (error) return err(error.message, 500);

  // Queue flashcard generation for the new copy
  void tryPublishNoteFlashcards({
    noteId: newNote.id,
    userId: user.id,
    title: newNote.title,
    content: newNote.content,
  });

  return ok({ success: true, noteId: newNote.id }, 201);
}
