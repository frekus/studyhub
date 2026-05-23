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

  // Verify user is a member
  const { data: membership } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return err("Group not found or access denied", 404);

  const [groupRes, membersRes] = await Promise.all([
    admin.from("study_groups").select("*").eq("id", id).single(),
    admin
      .from("study_group_members")
      .select("id, user_id, role, joined_at, users(id, full_name)")
      .eq("group_id", id)
      .order("joined_at", { ascending: true }),
  ]);

  if (groupRes.error) return err(groupRes.error.message, 500);

  return ok({ group: groupRes.data, members: membersRes.data ?? [] });
}
