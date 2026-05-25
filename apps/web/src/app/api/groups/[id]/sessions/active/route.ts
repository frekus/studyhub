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
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  const { data: session } = await admin
    .from("study_sessions")
    .select("*")
    .eq("group_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return ok({ session: null });

  // Count participants
  const { count } = await admin
    .from("session_participants")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);

  // Check if current user is a participant
  const { data: participation } = await admin
    .from("session_participants").select("id")
    .eq("session_id", session.id).eq("user_id", user.id).maybeSingle();

  return ok({
    session: {
      ...session,
      participant_count: count ?? 0,
      is_participant: !!participation,
    },
  });
}
