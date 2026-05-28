import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return err(error.message, 401);

  return ok({ user: data.user, session: data.session });
}
