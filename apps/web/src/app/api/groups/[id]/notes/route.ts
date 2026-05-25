import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string }>;

const ShareNoteSchema = z.object({
  noteId: z.string().uuid("noteId must be a valid UUID"),
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

  const { error } = await admin
    .from("study_group_notes")
    .insert({ group_id: id, note_id: parsed.data.noteId, shared_by: user.id });

  if (error && error.code !== "23505") return err(error.message, 500);

  return ok({ success: true });
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
