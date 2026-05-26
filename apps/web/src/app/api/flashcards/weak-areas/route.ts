import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("flashcard_performance")
    .select(`
      flashcard_id,
      note_id,
      correct_count,
      incorrect_count,
      flashcards!flashcard_id ( question, answer ),
      study_notes!note_id ( title )
    `)
    .eq("user_id", user.id)
    .or("incorrect_count.gt.correct_count,incorrect_count.gte.3")
    .order("incorrect_count", { ascending: false })
    .limit(10);

  if (error) return err(error.message, 500);

  const weakAreas = (data ?? []).map((row: Record<string, unknown>) => {
    const total = (row.correct_count as number) + (row.incorrect_count as number);
    const accuracy = total > 0 ? Math.round(((row.correct_count as number) / total) * 100) : 0;
    const fc = row.flashcards as { question: string; answer: string } | null;
    const note = row.study_notes as { title: string } | null;
    return {
      flashcard_id:   row.flashcard_id,
      note_id:        row.note_id,
      question:       fc?.question ?? "",
      answer:         fc?.answer ?? "",
      note_title:     note?.title ?? "Unknown note",
      incorrect_count: row.incorrect_count,
      correct_count:  row.correct_count,
      accuracy_pct:   accuracy,
    };
  });

  return ok({ weakAreas });
}
