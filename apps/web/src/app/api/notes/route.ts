import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, NOTE_TTL } from "@/lib/cache";
import { tryPublishNoteSummarize } from "@/lib/queue";
import { checkLimit, incrementUsage } from "@/lib/usage";
import { recordStudyActivity } from "@/lib/streaks";
import type { StudyNoteRow } from "@studyhub/database";

const CreateNoteSchema = z.object({
  title:     z.string().min(1, "title is required").max(500),
  content:   z.string().optional(),
  folder_id: z.string().uuid().nullable().optional(),
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

  void recordStudyActivity(user.id, "note_created", supabase).catch(console.error);

  void tryPublishNoteSummarize({
    noteId: note.id,
    userId: user.id,
    title: note.title,
    content: note.content,
  });

  return ok({ note }, 201);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const folderParam = searchParams.get("folder_id");

  // When filtering by folder, skip cache (small result set, infrequent)
  const listKey = folderParam ? null : cacheKeys.notesList(user.id);

  if (listKey) {
    const cached = await tryGet<{ notes: StudyNoteRow[] }>(listKey);
    if (cached) {
      const response = ok(cached);
      response.headers.set("X-Cache", "HIT");
      return response;
    }
  }

  let query = supabase
    .from("study_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (folderParam === "uncategorized") {
    query = query.is("folder_id", null) as typeof query;
  } else if (folderParam) {
    query = query.eq("folder_id", folderParam) as typeof query;
  }

  const { data: notes, error } = await query;

  if (error) return err(error.message, 500);

  if (listKey) await trySet(listKey, { notes }, NOTE_TTL);

  const response = ok({ notes });
  response.headers.set("X-Cache", "MISS");
  return response;
}
