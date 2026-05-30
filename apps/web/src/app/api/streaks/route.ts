import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  function watDate(daysAgo = 0): string { const now = new Date(); now.setMinutes(now.getMinutes() + now.getTimezoneOffset() + 60); now.setDate(now.getDate() - daysAgo); return now.toISOString().split("T")[0]; }
  const today = watDate();
  const fromDate = watDate(29);

  // Fetch streak + last 30 days of activity in parallel

  const [{ data: streak }, { data: activityRows }] = await Promise.all([
    supabase
      .from("study_streaks")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("study_activity")
      .select("activity_date, notes_created, flashcards_reviewed, exams_uploaded")
      .eq("user_id", user.id)
      .gte("activity_date", fromDate)
      .order("activity_date", { ascending: true }),
  ]);

  // Build a dense array of the last 30 days
  const activityMap: Record<string, number> = {};
  for (const row of activityRows ?? []) {
    activityMap[row.activity_date] =
      (row.notes_created ?? 0) +
      (row.flashcards_reviewed ?? 0) +
      (row.exams_uploaded ?? 0);
  }

  const activity: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = watDate(i);
    activity.push({ date: dateStr, count: activityMap[dateStr] ?? 0 });
  }

  return ok({
    current_streak:   streak?.current_streak   ?? 0,
    longest_streak:   streak?.longest_streak   ?? 0,
    total_study_days: streak?.total_study_days ?? 0,
    last_study_date:  streak?.last_study_date  ?? null,
    studied_today:    streak?.last_study_date  === today,
    activity,
  });
}
