import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { code } = await context.params;
  if (!code) return err("Invalid invite code", 400);

  const admin = createAdminClient();

  // Find group by invite code
  const { data: group, error: groupErr } = await admin
    .from("study_groups")
    .select("id, name")
    .eq("invite_code", code)
    .single();

  if (groupErr || !group) return err("Invalid or expired invite link", 404);

  // Check if user has been blocked from this group
  const { data: blocked } = await admin
    .from("group_blocked_members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (blocked) return err("You have been removed from this group and cannot rejoin via invite link.", 403);

  // Check if already a member
  const { data: existing } = await admin
    .from("study_group_members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return ok({ group: { name: group.name }, message: "Already a member" });
  }

  // Add as member
  const { error: joinErr } = await admin
    .from("study_group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "member" });

  if (joinErr) return err(joinErr.message, 500);

  return ok({ group: { name: group.name }, message: "Joined successfully" });
}
