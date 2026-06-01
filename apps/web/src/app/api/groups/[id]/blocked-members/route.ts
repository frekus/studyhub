import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("study_group_members").select("role")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return err("Only the group owner can view blocked members", 403);

  const { data: blocked, error } = await admin
    .from("group_blocked_members")
    .select("id, user_id, blocked_at")
    .eq("group_id", id)
    .order("blocked_at", { ascending: false });

  if (error) return err(error.message, 500);

  const userIds = (blocked ?? []).map((b: { user_id: string }) => b.user_id);
  let nameMap: Record<string, { name: string; avatar: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("users").select("id, full_name, avatar_url").in("id", userIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
      p.id, { name: p.full_name ?? "Unknown", avatar: p.avatar_url ?? null }
    ]));
  }

  const enriched = (blocked ?? []).map((b: { id: string; user_id: string; blocked_at: string }) => ({
    ...b,
    full_name: nameMap[b.user_id]?.name ?? "Unknown",
    avatar_url: nameMap[b.user_id]?.avatar ?? null,
  }));

  return ok({ blocked: enriched });
}

export async function DELETE(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { userId } = await request.json() as { userId: string };
  if (!userId) return err("userId required", 400);

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("study_group_members").select("role")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return err("Only the group owner can unblock members", 403);

  const { error } = await admin
    .from("group_blocked_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", userId);

  if (error) return err(error.message, 500);
  return ok({ success: true });
}
