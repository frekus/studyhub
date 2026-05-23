import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";
import { cacheKeys, tryGet, trySet, tryDel, EXAM_TTL } from "@/lib/cache";
import type { ExamUploadRow } from "@studyhub/database";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const singleKey = cacheKeys.examSingle(user.id, id);
  const nocache = new URL(request.url).searchParams.get("nocache") === "1";

  if (!nocache) {
    const cached = await tryGet<{ exam: ExamUploadRow }>(singleKey);
    if (cached) {
      const response = ok(cached);
      response.headers.set("X-Cache", "HIT");
      return response;
    }
  }

  const { data: exam, error } = await supabase
    .from("exam_uploads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error?.code === "PGRST116") return err("Exam not found", 404);
  if (error) return err(error.message, 500);
  if (!exam) return err("Exam not found", 404);

  await trySet(singleKey, { exam }, EXAM_TTL);

  const response = ok({ exam });
  response.headers.set("X-Cache", "MISS");
  return response;
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const { data: deleted, error } = await supabase
    .from("exam_uploads")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error?.code === "PGRST116") return err("Exam not found", 404);
  if (error) return err(error.message, 500);
  if (!deleted) return err("Exam not found", 404);

  await tryDel(
    cacheKeys.examSingle(user.id, id),
    cacheKeys.examsList(user.id),
  );

  return ok({ success: true });
}
