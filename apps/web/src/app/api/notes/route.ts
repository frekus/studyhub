import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, NOTE_TTL } from "@/lib/cache";
import { tryPublishNoteSummarize } from "@/lib/queue";
import { checkLimit, incrementUsage } from "@/lib/usage";
import type { StudyNoteRow } from "@studyhub/database";

const CreateNoteSchema = z.object({
  title: z.string().min(1, "title is required").max(500),
  content: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const parsed = CreateNoteSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const limitCheck = await checkLimit(user.id, "notes", supabase);
  if (!limitCheck.allowed) {
    return err("Note limit reached. Upgrade to create more notes.", 403);
  }

  const { data: note, error } = await supabase
    .from("study_notes")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single();

  if (error) return err(error.message, 500);

  void incrementUsage(user.id, "notes", supabase);
  await tryDel(cacheKeys.notesList(user.id));

  // Fire-and-forget: publish after the response is already determined.
  // Using void intentionally — a RabbitMQ failure must not block or fail the request.
  // ai_summary is nullable; the note is fully usable without it.
  void tryPublishNoteSummarize({
    noteId: note.id,
    userId: user.id,
    title: note.title,
    content: note.content,
  });

  return ok({ note }, 201);
}

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const listKey = cacheKeys.notesList(user.id);

  const cached = await tryGet<{ notes: StudyNoteRow[] }>(listKey);
  if (cached) {
    const response = ok(cached);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  const { data: notes, error } = await supabase
    .from("study_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  await trySet(listKey, { notes }, NOTE_TTL);

  const response = ok({ notes });
  response.headers.set("X-Cache", "MISS");
  return response;
}
