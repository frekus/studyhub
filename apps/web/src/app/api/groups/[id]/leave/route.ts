import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { data: membership } = await supabase
    .from("study_group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) return err("You are not a member of this group", 404);
  if (membership.role === "owner") return err("Group owners cannot leave. Delete the group instead.", 400);

  const { error } = await supabase
    .from("study_group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", user.id);

  if (error) return err(error.message, 500);

  return ok({ success: true });
}
