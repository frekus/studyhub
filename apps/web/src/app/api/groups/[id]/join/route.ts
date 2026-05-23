import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Verify group exists
  const { data: group } = await admin
    .from("study_groups")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!group) return err("Group not found", 404);

  // Insert membership — ignore unique constraint violations (already a member)
  const { error } = await admin
    .from("study_group_members")
    .insert({ group_id: id, user_id: user.id, role: "member" });

  if (error && error.code !== "23505") return err(error.message, 500);

  return ok({ success: true });
}
