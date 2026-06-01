import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

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
      .select("id, user_id, role, joined_at, users(id, full_name, avatar_url)")
      .eq("group_id", id)
      .order("joined_at", { ascending: true }),
  ]);

  if (groupRes.error) return err(groupRes.error.message, 500);

  return ok({ group: groupRes.data, members: membersRes.data ?? [] });
}

const RenameSchema = z.object({ name: z.string().min(1).max(100) });

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = RenameSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("study_group_members").select("role")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "owner") return err("Only the group owner can rename the group", 403);

  const { data: group, error } = await admin
    .from("study_groups").update({ name: parsed.data.name }).eq("id", id).select().single();
  if (error) return err(error.message, 500);

  return ok({ group });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: group } = await admin
    .from("study_groups").select("created_by").eq("id", id).single();
  if (group?.created_by !== user.id) return err("Only the group creator can delete this group", 403);

  const { error } = await admin.from("study_groups").delete().eq("id", id);
  if (error) return err(error.message, 500);

  return ok({ success: true });
}
