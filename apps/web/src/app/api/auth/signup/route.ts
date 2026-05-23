import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z.string().min(1, "full_name is required").max(255),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { email, password, full_name } = parsed.data;
  const supabase = await createClient();

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (authError) return err(authError.message, 400);
  if (!authData.user) return err("Failed to create user", 500);

  // Insert the public profile row
  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    full_name,
  });

  if (profileError) return err(profileError.message, 500);

  return ok({ user: authData.user, session: authData.session }, 201);
}
