import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";
import { checkLimit } from "@/lib/usage";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = CreateGroupSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const limitCheck = await checkLimit(user.id, "notes", supabase);
  if (limitCheck.tier === "free") {
    return err("Upgrade to Popular or Pro to create study groups.", 403);
  }

  const admin = createAdminClient();

  // Generate a short unique invite code
  const inviteCode = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
  const { data: group, error: groupErr } = await admin
    .from("study_groups")
    .insert({ name: parsed.data.name, created_by: user.id, invite_code: inviteCode })
    .select()
    .single();

  if (groupErr) return err(groupErr.message, 500);

  const { error: memberErr } = await admin
    .from("study_group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "owner" });

  if (memberErr) return err(memberErr.message, 500);

  return ok({ group }, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Get this user's memberships
  const { data: memberships, error: memErr } = await admin
    .from("study_group_members")
    .select("group_id, role")
    .eq("user_id", user.id);

  if (memErr) return err(memErr.message, 500);
  if (!memberships || memberships.length === 0) return ok({ groups: [] });

  const groupIds = memberships.map((m) => m.group_id);

  // Fetch groups
  const { data: groupRows, error: groupsErr } = await admin
    .from("study_groups")
    .select("*")
    .in("id", groupIds)
    .order("created_at", { ascending: false });

  if (groupsErr) return err(groupsErr.message, 500);

  // Member counts per group
  const counts = await Promise.all(
    groupIds.map(async (id) => {
      const { count } = await admin
        .from("study_group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", id);
      return { id, count: count ?? 0 };
    }),
  );
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]));
  const roleMap  = Object.fromEntries(memberships.map((m) => [m.group_id, m.role]));

  const groups = (groupRows ?? []).map((g) => ({
    ...g,
    member_count: countMap[g.id] ?? 0,
    role: roleMap[g.id] ?? "member",
  }));

  return ok({ groups });
}
