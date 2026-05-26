import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("flashcard_performance")
    .select(`
      flashcard_id,
      note_id,
      ease_factor,
      next_review_at,
      correct_count,
      incorrect_count,
      flashcards!flashcard_id ( question, answer ),
      study_notes!note_id ( title )
    `)
    .eq("user_id", user.id)
    .or(`next_review_at.lte.${now},next_review_at.is.null`)
    .order("next_review_at", { ascending: true, nullsFirst: true })
    .order("ease_factor", { ascending: true })
    .limit(20);

  if (error) return err(error.message, 500);

  const dueCards = (data ?? []).map((row: Record<string, unknown>) => {
    const fc   = row.flashcards as { question: string; answer: string } | null;
    const note = row.study_notes as { title: string } | null;
    return {
      flashcard_id: row.flashcard_id,
      note_id:      row.note_id,
      question:     fc?.question ?? "",
      answer:       fc?.answer ?? "",
      note_title:   note?.title ?? "Unknown note",
      ease_factor:  row.ease_factor,
      next_review_at: row.next_review_at,
    };
  });

  return ok({ dueCards });
}
