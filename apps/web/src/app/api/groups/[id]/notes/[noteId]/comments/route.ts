import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { z } from "zod";

type Params = Promise<{ id: string; noteId: string }>;

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  reaction: z.string().min(1).max(10).optional(),
}).refine((d) => d.content || d.reaction, { message: "content or reaction required" });

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  const { data: comments, error } = await admin
    .from("note_comments")
    .select("id, user_id, content, reaction, created_at")
    .eq("group_id", id)
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error) return err(error.message, 500);

  const commenterIds = [...new Set((comments ?? []).map((c) => c.user_id))];
  let nameMap: Record<string, string> = {};
  if (commenterIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", commenterIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
  }

  return ok({
    comments: (comments ?? []).map((c) => ({
      ...c,
      commenter_name: nameMap[c.user_id] ?? "Unknown",
      is_own: c.user_id === user.id,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }

  const parsed = CreateCommentSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid input", 400);

  const { data: comment, error } = await admin
    .from("note_comments")
    .insert({ group_id: id, note_id: noteId, user_id: user.id, ...parsed.data })
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok({ comment }, 201);
}
