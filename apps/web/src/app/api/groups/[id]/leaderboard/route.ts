import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

function getMondayISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

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

  const { data: members } = await admin
    .from("study_group_members")
    .select("user_id, users(id, full_name)")
    .eq("group_id", id);

  if (!members || members.length === 0) return ok({ leaderboard: [] });

  const memberIds = members.map((m) => m.user_id);
  const monday = getMondayISO();

  const { data: activities } = await admin
    .from("study_activity")
    .select("user_id, notes_created, flashcards_reviewed, activity_date")
    .in("user_id", memberIds)
    .gte("activity_date", monday);

  // Build score map: notes×3 + flashcards×1 + study_days×5
  const scoreMap: Record<string, { notes: number; flashcards: number; days: Set<string> }> = {};
  for (const id of memberIds) {
    scoreMap[id] = { notes: 0, flashcards: 0, days: new Set() };
  }
  for (const a of activities ?? []) {
    const s = scoreMap[a.user_id];
    if (!s) continue;
    s.notes += a.notes_created ?? 0;
    s.flashcards += a.flashcards_reviewed ?? 0;
    s.days.add(a.activity_date);
  }

  const nameMap: Record<string, string> = {};
  for (const m of members) {
    const u = m.users as { id: string; full_name: string | null } | null;
    nameMap[m.user_id] = u?.full_name ?? "Unknown";
  }

  const ranked = memberIds
    .map((uid) => {
      const s = scoreMap[uid] ?? { notes: 0, flashcards: 0, days: new Set() };
      const score = s.notes * 3 + s.flashcards * 1 + s.days.size * 5;
      return {
        user_id: uid,
        name: nameMap[uid] ?? "Unknown",
        score,
        notes_created: s.notes,
        flashcards_reviewed: s.flashcards,
        study_days: s.days.size,
        is_current_user: uid === user.id,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return ok({ leaderboard: ranked, week_start: monday });
}
