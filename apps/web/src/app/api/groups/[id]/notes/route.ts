import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string }>;

const ShareNoteSchema = z.object({
  noteId:   z.string().uuid("noteId must be a valid UUID"),
  mentions: z.array(z.string().uuid()).optional(),
});

async function assertMembership(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = ShareNoteSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const admin = createAdminClient();

  // Must be a group member
  if (!(await assertMembership(admin, id, user.id))) {
    return err("Group not found or access denied", 404);
  }

  // Must own the note
  const { data: note } = await admin
    .from("study_notes")
    .select("id")
    .eq("id", parsed.data.noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note) return err("Note not found", 404);

  const { data: inserted, error } = await admin
    .from("study_group_notes")
    .insert({ group_id: id, note_id: parsed.data.noteId, shared_by: user.id })
    .select("id")
    .single();

  if (error && error.code !== "23505") return err(error.message, 500);

  // Fetch full shared note data to return to the client
  const rowId = inserted?.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fullRow } = rowId ? await (admin as any)
    .from("study_group_notes")
    .select("id, note_id, group_id, shared_at, shared_by, study_notes!inner(title, content, ai_summary), users!shared_by(full_name)")
    .eq("id", rowId)
    .single() : { data: null };

  const sharedNote = fullRow ? {
    id:          fullRow.id,
    note_id:     fullRow.note_id,
    group_id:    fullRow.group_id,
    shared_at:   fullRow.shared_at,
    shared_by:   fullRow.shared_by,
    sharer_name: fullRow.users?.full_name ?? "Unknown",
    title:       fullRow.study_notes?.title ?? "",
    content:     fullRow.study_notes?.content ?? "",
    ai_summary:  fullRow.study_notes?.ai_summary ?? null,
  } : null;

  // Create mention notifications
  const mentions = parsed.data.mentions ?? [];
  if (mentions.length > 0) {
    const sharerName = fullRow?.users?.full_name ?? "Someone";
    const noteTitle  = fullRow?.study_notes?.title ?? "a note";

    await admin.from("group_notifications").insert(
      mentions.map((mentionedUserId) => ({
        user_id:      mentionedUserId,
        group_id:     id,
        from_user_id: user.id,
        type:         "mention",
        message:      `${sharerName} mentioned you in "${noteTitle}"`,
        note_id:      parsed.data.noteId,
      })),
    );
  }

  return ok({ sharedNote }, 201);
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  if (!(await assertMembership(admin, id, user.id))) {
    return err("Group not found or access denied", 404);
  }

  const { data, error } = await admin
    .from("study_group_notes")
    .select("id, shared_at, shared_by, study_notes(id, title, content, ai_summary, created_at)")
    .eq("group_id", id)
    .order("shared_at", { ascending: false });

  if (error) return err(error.message, 500);

  // Resolve sharer display names from public.users
  const sharerIds = [...new Set((data ?? []).map((n) => n.shared_by).filter(Boolean))];
  let sharerMap: Record<string, string> = {};
  if (sharerIds.length > 0) {
    const { data: profiles } = await admin
      .from("users")
      .select("id, full_name")
      .in("id", sharerIds);
    sharerMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]),
    );
  }

  // Return a flat structure that includes all fields the client needs
  const notes = (data ?? []).map((n) => {
    const sn = Array.isArray(n.study_notes) ? n.study_notes[0] : n.study_notes;
    return {
      id: n.id,
      note_id: sn?.id ?? "",
      group_id: id,
      shared_at: n.shared_at,
      shared_by: n.shared_by,
      sharer_name: sharerMap[n.shared_by] ?? "Unknown",
      title: sn?.title ?? "",
      content: sn?.content ?? "",
      ai_summary: sn?.ai_summary ?? null,
    };
  });

  return ok({ notes });
}
