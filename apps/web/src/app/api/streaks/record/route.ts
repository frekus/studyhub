import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { recordStudyActivity } from "@/lib/streaks";

const MILESTONES = [3, 7, 14, 30];
const MILESTONE_MESSAGES: Record<number, string> = {
  3:  "🔥 3 day streak! Keep it up!",
  7:  "🔥 One week streak! You're on fire!",
  14: "💪 2 week streak! Incredible consistency!",
  30: "🏆 30 day streak! You're a StudyHub legend!",
};

const BodySchema = z.object({
  activity_type: z.enum(["note_created", "flashcard_reviewed", "exam_uploaded"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON", 400); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  // Fetch streak before recording (to detect milestone crossing)
  const { data: before } = await supabase
    .from("study_streaks")
    .select("current_streak")
    .eq("user_id", user.id)
    .single();

  await recordStudyActivity(user.id, parsed.data.activity_type, supabase);

  // Fetch updated streak
  const today = new Date().toISOString().split("T")[0];
  const { data: streak } = await supabase
    .from("study_streaks")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const newStreak = streak?.current_streak ?? 0;
  const prevStreak = before?.current_streak ?? 0;

  // Determine if a milestone was just crossed
  const milestone = MILESTONES.find(
    (m) => newStreak >= m && prevStreak < m,
  ) ?? null;

  return ok({
    current_streak:   streak?.current_streak   ?? 0,
    longest_streak:   streak?.longest_streak   ?? 0,
    total_study_days: streak?.total_study_days ?? 0,
    last_study_date:  streak?.last_study_date  ?? null,
    studied_today:    streak?.last_study_date  === today,
    milestone,
    milestone_message: milestone ? MILESTONE_MESSAGES[milestone] : null,
  });
}
