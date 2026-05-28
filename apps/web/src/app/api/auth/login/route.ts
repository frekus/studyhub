import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, err, validationErr } from "@/lib/response";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  // Rate limit: 5 attempts per IP per 15 minutes
  const ip = getClientIp(request);
  const { allowed, remaining, resetInSeconds } = await rateLimit(
    `login:${ip}`,
    5,
    15 * 60
  );
  if (!allowed) return rateLimitResponse(resetInSeconds, "You can only attempt login 5 times per 15 minutes.");

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

  // On success, clear the rate limit counter for this IP
  try {
    const { redis } = await import("@studyhub/cache");
    await redis.del(`rl:login:${ip}`);
  } catch { /* non-fatal */ }

  return ok({ user: data.user, session: data.session });
}
