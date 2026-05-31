import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { invalidateProfile } from "@/lib/student-profile";
import { recordStudyActivity } from "@/lib/streaks";

const Schema = z.object({
  flashcardId: z.string().uuid(),
  noteId:      z.string().uuid(),
  correct:     z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { flashcardId, noteId, correct } = parsed.data;

  // Fetch existing record if any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("flashcard_performance")
    .select("*")
    .eq("user_id", user.id)
    .eq("flashcard_id", flashcardId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const cur = existing as {
      correct_count: number;
      incorrect_count: number;
      interval_days: number;
      ease_factor: number;
    };

    let newInterval  = cur.interval_days;
    let newEase      = cur.ease_factor;
    let nextReviewAt: string;

    if (correct) {
      // SM-2: quality = 4 (correct after hesitation)
      newEase     = Math.max(1.3, cur.ease_factor + (0.1 - 1 * (0.08 + 1 * 0.02)));
      newInterval = Math.max(1, Math.round(cur.interval_days * newEase));
      const next  = new Date();
      next.setDate(next.getDate() + newInterval);
      nextReviewAt = next.toISOString();
    } else {
      newInterval  = 1;
      newEase      = Math.max(1.3, cur.ease_factor - 0.2);
      const next   = new Date();
      next.setDate(next.getDate() + 1);
      nextReviewAt = next.toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("flashcard_performance")
      .update({
        correct_count:   correct ? cur.correct_count + 1   : cur.correct_count,
        incorrect_count: correct ? cur.incorrect_count      : cur.incorrect_count + 1,
        interval_days:   newInterval,
        ease_factor:     newEase,
        next_review_at:  nextReviewAt,
        last_reviewed_at: now,
        updated_at:      now,
      })
      .eq("user_id", user.id)
      .eq("flashcard_id", flashcardId);
  } else {
    const next = new Date();
    next.setDate(next.getDate() + (correct ? 1 : 1));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("flashcard_performance")
      .insert({
        user_id:          user.id,
        flashcard_id:     flashcardId,
        note_id:          noteId,
        correct_count:    correct ? 1 : 0,
        incorrect_count:  correct ? 0 : 1,
        interval_days:    1,
        ease_factor:      correct ? 2.5 : 2.3,
        next_review_at:   next.toISOString(),
        last_reviewed_at: now,
      });
  }

  void invalidateProfile(user.id).catch(() => {});
  void recordStudyActivity(user.id, "flashcard_reviewed", supabase).catch(console.error);
  return ok({ success: true });
}
