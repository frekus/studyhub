import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string }>;

const CreateSchema = z.object({
  title:        z.string().min(1).max(200),
  scheduled_at: z.string().datetime(),
  note_title:   z.string().optional(),
});

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin.from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: sessions, error } = await admin
    .from("scheduled_sessions")
    .select("*")
    .eq("group_id", id)
    .in("status", ["voting", "confirmed"])
    .order("scheduled_at", { ascending: true });

  if (error) return err(error.message, 500);

  // Get votes for each session
  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  let votesMap: Record<string, { agree: number; disagree: number; my_vote: string | null }> = {};

  if (sessionIds.length > 0) {
    const { data: votes } = await admin
      .from("session_votes")
      .select("scheduled_session_id, user_id, vote")
      .in("scheduled_session_id", sessionIds);

    for (const sid of sessionIds) {
      const sv = (votes ?? []).filter((v: { scheduled_session_id: string }) => v.scheduled_session_id === sid);
      votesMap[sid] = {
        agree:    sv.filter((v: { vote: string }) => v.vote === "agree").length,
        disagree: sv.filter((v: { vote: string }) => v.vote === "disagree").length,
        my_vote:  sv.find((v: { user_id: string }) => v.user_id === user.id)?.vote ?? null,
      };
    }
  }

  // Resolve scheduler names
  const userIds = [...new Set((sessions ?? []).map((s: { scheduled_by: string }) => s.scheduled_by))];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("users").select("id, full_name").in("id", userIds);
    nameMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? "Member"]));
  }

  const enriched = (sessions ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    scheduler_name: nameMap[s.scheduled_by as string] ?? "Member",
    votes: votesMap[s.id as string] ?? { agree: 0, disagree: 0, my_vote: null },
  }));

  return ok({ sessions: enriched });
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { data: session, error } = await admin
    .from("scheduled_sessions")
    .insert({ group_id: id, scheduled_by: user.id, ...parsed.data })
    .select().single();

  if (error) return err(error.message, 500);

  // Auto-vote agree by scheduler
  await admin.from("session_votes").insert({
    scheduled_session_id: session.id, user_id: user.id, vote: "agree"
  });

  // Notify all group members
  const { data: members } = await admin
    .from("study_group_members").select("user_id").eq("group_id", id);
  const { data: scheduler } = await admin.from("users").select("full_name").eq("id", user.id).single();
  const schedulerName = (scheduler as { full_name: string | null } | null)?.full_name ?? "A member";
  const scheduledDate = new Date(parsed.data.scheduled_at).toLocaleString("en-NG", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos"
  });

  const notifs = (members ?? [])
    .filter((m: { user_id: string }) => m.user_id !== user.id)
    .map((m: { user_id: string }) => ({
      user_id: m.user_id,
      from_user_id: user.id,
      group_id: id,
      type: "session_scheduled",
      message: `${schedulerName} scheduled a live session: "${parsed.data.title}" on ${scheduledDate}. Vote to confirm!`,
    }));

  if (notifs.length > 0) await admin.from("group_notifications").insert(notifs);

  return ok({ session }, 201);
}
