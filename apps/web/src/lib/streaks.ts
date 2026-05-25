// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type ActivityType = "note_created" | "flashcard_reviewed" | "exam_uploaded";

const ACTIVITY_COLUMN: Record<ActivityType, string> = {
  note_created:       "notes_created",
  flashcard_reviewed: "flashcards_reviewed",
  exam_uploaded:      "exams_uploaded",
};

export async function recordStudyActivity(
  userId: string,
  activityType: ActivityType,
  supabase: SupabaseClient,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const column = ACTIVITY_COLUMN[activityType];

  await supabase.rpc("increment_activity", {
    p_user_id: userId,
    p_date: today,
    p_column: column,
  });

  await updateStreak(userId, today, supabase);
}

export async function updateStreak(
  userId: string,
  today: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: streak } = await supabase
    .from("study_streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  const todayDate = new Date(today);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (!streak) {
    await supabase.from("study_streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_study_date: today,
      total_study_days: 1,
    });
    return;
  }

  if (streak.last_study_date === today) return;

  const newStreak = streak.last_study_date === yesterdayStr
    ? streak.current_streak + 1
    : 1;

  await supabase.from("study_streaks").upsert(
    {
      user_id: userId,
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, streak.longest_streak),
      last_study_date: today,
      total_study_days: streak.total_study_days + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
