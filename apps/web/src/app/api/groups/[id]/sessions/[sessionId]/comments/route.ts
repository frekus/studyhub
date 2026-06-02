import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string; sessionId: string }>;

const CommentSchema = z.object({ content: z.string().min(1).max(500) });

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin.from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: comments, error } = await admin
    .from("session_comments")
    .select("id, content, created_at, user_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return err(error.message, 500);

  // Resolve names
  const userIds = [...new Set((comments ?? []).map((c: { user_id: string }) => c.user_id))];
  let nameMap: Record<string, { name: string; avatar: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name, avatar_url").in("id", userIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
      p.id, { name: p.full_name ?? "Member", avatar: p.avatar_url ?? null }
    ]));
  }

  const enriched = (comments ?? []).map((c: { id: string; content: string; created_at: string; user_id: string }) => ({
    ...c,
    full_name: nameMap[c.user_id]?.name ?? "Member",
    avatar_url: nameMap[c.user_id]?.avatar ?? null,
    is_mine: c.user_id === user.id,
  }));

  return ok({ comments: enriched });
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: comment, error } = await admin
    .from("session_comments")
    .insert({ session_id: sessionId, user_id: user.id, content: parsed.data.content })
    .select().single();

  if (error) return err(error.message, 500);

  const { data: profile } = await admin.from("users").select("full_name, avatar_url").eq("id", user.id).single();

  return ok({
    comment: {
      ...comment,
      full_name: (profile as { full_name: string | null; avatar_url: string | null } | null)?.full_name ?? "Member",
      avatar_url: (profile as { full_name: string | null; avatar_url: string | null } | null)?.avatar_url ?? null,
      is_mine: true,
    }
  }, 201);
}
