import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from("study_plans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error?.code === "PGRST116") return err("Plan not found", 404);
  if (error) return err((error as { message: string }).message, 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: days } = await (supabase as any)
    .from("study_plan_days")
    .select("*")
    .eq("plan_id", id)
    .order("day_number", { ascending: true });

  const today = new Date().toISOString().split("T")[0];
  const enrichedDays = ((days ?? []) as Record<string, unknown>[]).map((d) => ({
    ...d,
    is_today: d.study_date === today,
    is_past:  (d.study_date as string) < today,
  }));

  const total     = enrichedDays.length;
  const completed = enrichedDays.filter((d) => (d as Record<string, unknown>)["is_completed"]).length;

  return ok({ plan, days: enrichedDays, progress: { total, completed } });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("study_plans")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return err((error as { message: string }).message, 500);
  return ok({ success: true });
}
