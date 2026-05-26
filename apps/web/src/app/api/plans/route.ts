import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { tryPublishStudyPlanGenerate } from "@/lib/queue";

const CreatePlanSchema = z.object({
  title:    z.string().min(1).max(200),
  subject:  z.string().min(1).max(200),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "examDate must be YYYY-MM-DD"),
  noteIds:  z.array(z.string().uuid()).min(1, "Select at least one note"),
});

export async function GET() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans, error } = await (supabase as any)
    .from("study_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true });

  if (error) return err((error as { message: string }).message, 500);

  const planList = (plans ?? []) as Record<string, unknown>[];
  const planIds = planList.map((p) => p.id as string);
  const progressMap: Record<string, { total: number; completed: number }> = {};

  if (planIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: days } = await (supabase as any)
      .from("study_plan_days")
      .select("plan_id, is_completed")
      .in("plan_id", planIds);

    for (const day of (days ?? []) as Record<string, unknown>[]) {
      const pid = day.plan_id as string;
      if (!progressMap[pid]) progressMap[pid] = { total: 0, completed: 0 };
      progressMap[pid].total += 1;
      if (day.is_completed) progressMap[pid].completed += 1;
    }
  }

  const result = planList.map((p) => ({
    ...p,
    progress: progressMap[p.id as string] ?? { total: 0, completed: 0 },
  }));

  return ok({ plans: result });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = CreatePlanSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { title, subject, examDate, noteIds } = parsed.data;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  if (exam <= today) return err("examDate must be in the future", 400);

  const daysUntilExam = Math.max(1, Math.ceil((exam.getTime() - today.getTime()) / 86_400_000));

  const { data: notes } = await supabase
    .from("study_notes")
    .select("id, title")
    .in("id", noteIds)
    .eq("user_id", user.id);

  const notesTitles = (notes ?? []).map((n) => n.title as string);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from("study_plans")
    .insert({ user_id: user.id, title, subject, exam_date: examDate, status: "generating", note_ids: noteIds })
    .select()
    .single();

  if (error) return err((error as { message: string }).message, 500);

  const planRow = plan as Record<string, unknown>;

  void tryPublishStudyPlanGenerate({
    planId:       planRow.id as string,
    userId:       user.id,
    examDate,
    subject,
    noteIds,
    notesTitles,
    daysUntilExam,
  });

  return ok({ plan: planRow }, 201);
}
