import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

export const maxDuration = 60;

type Params = Promise<{ id: string }>;

export async function POST(_req: Request, { params }: { params: Params }) {
  const { id: noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Rate limit: 10 flashcard generations per user per hour
  const { rateLimit, rateLimitResponse } = await import("@/lib/rate-limit");
  const { allowed, resetInSeconds } = await rateLimit(
    `flashcards:generate:${user.id}`,
    10,
    60 * 60
  );
  if (!allowed) return rateLimitResponse(resetInSeconds, "You can generate flashcards 10 times per hour.");

  const { data: note, error: noteErr } = await supabase
    .from("study_notes")
    .select("title, content")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .single();

  if (noteErr?.code === "PGRST116") return err("Note not found", 404);
  if (noteErr) return err(noteErr.message, 500);
  if (!note?.content) return err("Note has no content to generate flashcards from", 400);

  // Get existing flashcard questions to avoid duplicates
  const { data: existing } = await supabase
    .from("flashcards")
    .select("question")
    .eq("note_id", noteId)
    .eq("user_id", user.id);

  const existingQuestions = (existing ?? []).map((f) => f.question).join("\n");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Generate 5 MORE flashcards for this note.
${existingQuestions ? `These questions already exist (do not repeat them):\n${existingQuestions}\n` : ""}
Note title: ${note.title}
Note content: ${note.content.slice(0, 4000)}

Generate 5 new flashcards covering different aspects not already covered.
Return ONLY valid JSON array with this exact format:
[{"question": "...", "answer": "..."}]`,
      }],
    });
    const block = response.content[0];
    raw = block.type === "text" ? block.text : "[]";
  } catch {
    return err("AI service temporarily unavailable", 503);
  }

  let cards: { question: string; answer: string }[];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    cards = match ? (JSON.parse(match[0]) as { question: string; answer: string }[]) : [];
    if (!Array.isArray(cards)) cards = [];
  } catch {
    return err("Failed to parse AI response", 500);
  }

  cards = cards.filter((c) => c.question && c.answer).slice(0, 5);
  if (cards.length === 0) return err("No new flashcards could be generated", 500);

  const rows = cards.map((c) => ({
    note_id:  noteId,
    user_id:  user.id,
    question: c.question,
    answer:   c.answer,
  }));

  const { data: flashcards, error: insertErr } = await supabase
    .from("flashcards")
    .insert(rows)
    .select();

  if (insertErr) return err(insertErr.message, 500);

  return ok({ flashcards: flashcards ?? [] });
}
