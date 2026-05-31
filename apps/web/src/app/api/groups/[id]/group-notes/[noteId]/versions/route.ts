import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; noteId: string }>;

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin.from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: versions, error } = await admin
    .from("group_note_versions")
    .select("id, version_number, title, content, edited_by, created_at")
    .eq("group_note_id", noteId)
    .order("version_number", { ascending: false });

  if (error) return err(error.message, 500);

  // Resolve editor names
  const editorIds = [...new Set((versions ?? []).map(v => v.edited_by))];
  let nameMap: Record<string, string> = {};
  if (editorIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", editorIds);
    nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name ?? "Unknown"]));
  }

  const enriched = (versions ?? []).map(v => ({
    ...v,
    editor_name: nameMap[v.edited_by] ?? "Unknown",
  }));

  return ok({ versions: enriched });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: note } = await admin.from("group_notes").select("*")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (!note) return err("Note not found", 404);

  // Get next version number
  const { data: latest } = await admin.from("group_note_versions")
    .select("version_number").eq("group_note_id", noteId)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();

  const nextVersion = (latest?.version_number ?? 0) + 1;

  const { data: version, error } = await admin.from("group_note_versions").insert({
    group_note_id: noteId,
    group_id: id,
    version_number: nextVersion,
    title: note.title,
    content: note.content,
    edited_by: user.id,
  }).select().single();

  if (error) return err(error.message, 500);
  return ok({ version }, 201);
}
