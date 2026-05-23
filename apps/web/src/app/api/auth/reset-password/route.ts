import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const Schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
  });

  if (error) return err(error.message, 400);
  return ok({ sent: true });
}
