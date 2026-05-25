import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string; sessionId: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  // Must be group member
  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  // Session must be active
  const { data: session } = await admin
    .from("study_sessions").select("id, is_active")
    .eq("id", sessionId).eq("group_id", id).maybeSingle();
  if (!session) return err("Session not found", 404);
  if (!session.is_active) return err("Session has ended", 410);

  // Insert participant (ignore if already joined)
  const { error } = await admin
    .from("session_participants")
    .insert({ session_id: sessionId, user_id: user.id });
  if (error && error.code !== "23505") return err(error.message, 500);

  return ok({ success: true });
}
