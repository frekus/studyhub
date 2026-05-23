import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const PatchSchema = z.object({
  full_name: z.string().min(1).max(255),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err("Unauthorized", 401);

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { full_name } = parsed.data;

  const { data: profile, error: updateError } = await supabase
    .from("users")
    .update({ full_name })
    .eq("id", user.id)
    .select()
    .single();

  if (updateError) return err(updateError.message, 500);

  return ok({ user: { ...profile, email: user.email } });
}
