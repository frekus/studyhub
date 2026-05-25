import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";
import { tryPublishGroupNoteSummarize } from "@/lib/queue";

type Params = Promise<{ id: string }>;

const CreateSchema = z.object({
  title:   z.string().min(1).max(500),
  content: z.string().optional(),
});

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: notes, error } = await admin
    .from("group_notes").select("*")
    .eq("group_id", id)
    .order("created_at", { ascending: false });
  if (error) return err(error.message, 500);

  // Resolve editor names
  const userIds = [...new Set([
    ...(notes ?? []).map((n) => n.created_by),
    ...(notes ?? []).map((n) => n.last_edited_by).filter(Boolean),
  ] as string[])];

  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", userIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
  }

  const enriched = (notes ?? []).map((n) => ({
    ...n,
    creator_name:     nameMap[n.created_by] ?? "Unknown",
    last_editor_name: n.last_edited_by ? (nameMap[n.last_edited_by] ?? "Unknown") : null,
  }));

  return ok({ notes: enriched });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: note, error } = await admin
    .from("group_notes")
    .insert({ group_id: id, created_by: user.id, last_edited_by: user.id, ...parsed.data })
    .select().single();
  if (error) return err(error.message, 500);

  void tryPublishGroupNoteSummarize({
    groupNoteId: note.id, groupId: id,
    title: note.title, content: note.content,
  });

  return ok({ note }, 201);
}
