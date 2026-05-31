import Anthropic from "@anthropic-ai/sdk";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

type Params = Promise<{ id: string; noteId: string }>;

async function assertMember(admin: ReturnType<typeof createAdminClient>, groupId: string, userId: string) {
  const { data } = await admin.from("study_group_members").select("id")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: flashcards } = await admin.from("flashcards")
    .select("id, question, answer, created_at")
    .eq("group_note_id", noteId)
    .order("created_at", { ascending: true });

  return ok({ flashcards: flashcards ?? [] });
}

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id, noteId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // Rate limit: 10 generations per user per hour
  const { allowed, resetInSeconds } = await rateLimit(`flashcard:gen:${user.id}`, 10, 3600);
  if (!allowed) return rateLimitResponse(resetInSeconds, "Flashcard generation limit reached.");

  const admin = createAdminClient();
  if (!(await assertMember(admin, id, user.id))) return err("Access denied", 403);

  const { data: note } = await admin.from("group_notes").select("title, content")
    .eq("id", noteId).eq("group_id", id).maybeSingle();
  if (!note) return err("Note not found", 404);
  if (!note.content || note.content.trim().length < 50)
    return err("Note content is too short to generate flashcards", 400);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Generate 8-12 flashcards from this study note. Return ONLY a JSON array of objects with "question" and "answer" fields. No markdown, no explanation.\n\nTitle: ${note.title}\n\nContent: ${note.content.slice(0, 4000)}`,
    }],
  });

  const block = response.content[0];
  if (block.type !== "text") return err("AI generation failed", 500);

  let cards: { question: string; answer: string }[];
  try {
    const clean = block.text.replace(/```json|```/g, "").trim();
    cards = JSON.parse(clean);
    if (!Array.isArray(cards)) throw new Error("Not an array");
  } catch {
    return err("Failed to parse AI response", 500);
  }

  const rows = cards.map(c => ({
    note_id: noteId,
    group_note_id: noteId,
    user_id: user.id,
    question: c.question,
    answer: c.answer,
  }));

  const { data: inserted, error } = await admin.from("flashcards").insert(rows).select();
  if (error) return err(error.message, 500);

  return ok({ flashcards: inserted }, 201);
}
