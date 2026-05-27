import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; userId: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id: groupId, userId: targetUserId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Caller must be the group owner
  const { data: callerMembership } = await admin
    .from("study_group_members").select("role")
    .eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (callerMembership?.role !== "owner") return err("Only the group owner can remove members", 403);

  // Cannot remove yourself (the owner)
  if (targetUserId === user.id) return err("Owner cannot remove themselves", 400);

  const { error } = await admin
    .from("study_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);

  if (error) return err(error.message, 500);

  return ok({ success: true });
}
