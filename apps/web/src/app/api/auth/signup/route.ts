import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// ── Password strength validator ──────────────────────────────────────────
function validatePassword(password: string): string | null {
  if (password.length < 8)          return "Password must be at least 8 characters long.";
  if (!/[A-Z]/.test(password))      return "Password must contain at least one uppercase letter (A-Z).";
  if (!/[0-9]/.test(password))      return "Password must contain at least one number (0-9).";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character (!@#$%^&*).";
  return null;
}

// ── Friendly error messages for Supabase errors ──────────────────────────
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("duplicate"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Please enter a valid email address.";
  if (m.includes("password"))
    return "Your password does not meet the security requirements. Please use a stronger password.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many sign-up attempts. Please wait a few minutes before trying again.";
  if (m.includes("email") && m.includes("send"))
    return "We could not send a confirmation email. Please check your email address and try again.";
  if (m.includes("network") || m.includes("timeout"))
    return "Connection error. Please check your internet and try again.";
  return "Something went wrong. Please try again or contact support@studyhubai.xyz.";
}

const SignupSchema = z.object({
  email:     z.string().email("Please enter a valid email address."),
  password:  z.string().min(1, "Password is required."),
  full_name: z.string().min(1, "Full name is required.").max(255),
});

export async function POST(request: Request) {
  // Rate limit: 10 signups per IP per hour
  const ip = getClientIp(request);
  const { allowed, resetInSeconds } = await rateLimit(`signup:${ip}`, 10, 60 * 60);
  if (!allowed) return rateLimitResponse(resetInSeconds, "Maximum 10 sign-up attempts per hour from this device.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("Invalid request. Please try again.", 400);
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) return validationErr(parsed.error);

  const { email, password, full_name } = parsed.data;

  // ── Validate password strength BEFORE hitting Supabase ──────────────
  const pwError = validatePassword(password);
  if (pwError) return err(pwError, 400);

  const supabase = await createClient();

  // Create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });

  if (authError) {
    console.error("[signup] Supabase error:", authError.message);
    return err(friendlyAuthError(authError.message), 400);
  }
  if (!authData.user) return err("We could not create your account. Please try again.", 500);

  // Insert the public profile row
  const { error: profileError } = await supabase.from("users").insert({
    id: authData.user.id,
    full_name,
  });

  if (profileError) {
    // Non-fatal if profile insert fails — user can still log in
    console.error("[signup] Profile insert failed:", profileError.message);
  }

  return ok({ user: authData.user, session: authData.session }, 201);
}
