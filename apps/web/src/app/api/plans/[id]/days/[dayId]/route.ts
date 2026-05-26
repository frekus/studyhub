import { z } from "zod";
import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

type Params = Promise<{ id: string; dayId: string }>;

const PatchSchema = z.object({
  is_completed: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id: planId, dayId } = await params;
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: day, error } = await (supabase as any)
    .from("study_plan_days")
    .update({ is_completed: parsed.data.is_completed })
    .eq("id", dayId)
    .eq("plan_id", planId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error?.code === "PGRST116") return err("Day not found", 404);
  if (error) return err((error as { message: string }).message, 500);

  return ok({ day });
}
