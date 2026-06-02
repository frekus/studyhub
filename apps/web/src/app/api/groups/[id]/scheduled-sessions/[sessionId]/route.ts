import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; sessionId: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("scheduled_sessions").select("scheduled_by")
    .eq("id", sessionId).eq("group_id", id).maybeSingle();

  if (!session) return err("Session not found", 404);

  // Only scheduler or group owner can cancel
  const { data: membership } = await admin
    .from("study_group_members").select("role")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();

  if (session.scheduled_by !== user.id && membership?.role !== "owner")
    return err("Only the scheduler or group owner can cancel", 403);

  await admin.from("scheduled_sessions")
    .update({ status: "cancelled" }).eq("id", sessionId);

  return ok({ success: true });
}
