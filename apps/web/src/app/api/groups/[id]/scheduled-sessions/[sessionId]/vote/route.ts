import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string; sessionId: string }>;
const VoteSchema = z.object({ vote: z.enum(["agree", "disagree"]) });

export async function POST(req: Request, { params }: { params: Params }) {
  const { id, sessionId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("study_group_members").select("id")
    .eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return err("Access denied", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  await admin.from("session_votes").upsert(
    { scheduled_session_id: sessionId, user_id: user.id, vote: parsed.data.vote },
    { onConflict: "scheduled_session_id,user_id" }
  );

  // Get updated vote counts
  const { data: votes } = await admin
    .from("session_votes").select("vote")
    .eq("scheduled_session_id", sessionId);

  const agree    = (votes ?? []).filter((v: { vote: string }) => v.vote === "agree").length;
  const disagree = (votes ?? []).filter((v: { vote: string }) => v.vote === "disagree").length;

  // Get total member count
  const { count: memberCount } = await admin
    .from("study_group_members").select("*", { count: "exact", head: true })
    .eq("group_id", id);

  // Auto-confirm if majority agrees
  if (agree > (memberCount ?? 0) / 2) {
    await admin.from("scheduled_sessions")
      .update({ status: "confirmed" }).eq("id", sessionId);

    // Notify all members of confirmation
    const { data: members } = await admin
      .from("study_group_members").select("user_id").eq("group_id", id);
    const { data: sess } = await admin
      .from("scheduled_sessions").select("title, scheduled_at").eq("id", sessionId).single();
    const scheduledDate = sess ? new Date((sess as { scheduled_at: string }).scheduled_at).toLocaleString("en-NG", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos"
    }) : "";

    const notifs = (members ?? []).map((m: { user_id: string }) => ({
      user_id: m.user_id, from_user_id: user.id, group_id: id,
      type: "session_confirmed",
      message: `✅ Session confirmed: "${(sess as { title: string } | null)?.title}" on ${scheduledDate}. See you there!`,
    }));
    if (notifs.length > 0) await admin.from("group_notifications").insert(notifs);
  }

  return ok({ agree, disagree, my_vote: parsed.data.vote });
}
