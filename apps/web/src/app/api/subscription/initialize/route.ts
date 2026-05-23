import { createClient, requireUser } from "@/lib/supabase/server";
import { ok, err } from "@/lib/response";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  let body: unknown;
  try { body = await request.json(); } catch { return err("Invalid JSON body", 400); }

  const { plan, billing } = body as { plan?: string; billing?: string };

  if (plan !== "popular" && plan !== "pro") {
    return err("plan must be 'popular' or 'pro'", 400);
  }
  if (billing !== "monthly" && billing !== "annual") {
    return err("billing must be 'monthly' or 'annual'", 400);
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return err("Paystack not configured", 500);

  const planConfig = PLANS[plan as PlanTier] as typeof PLANS.popular;
  const planCode = billing === "monthly"
    ? planConfig.paystack_monthly_plan_code
    : planConfig.paystack_annual_plan_code;
  const amount = billing === "monthly"
    ? planConfig.monthly_price * 100
    : planConfig.annual_price * 100;

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/subscription/verify`;

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email:    user.email,
      amount,
      currency: "NGN",
      plan:     planCode,
      metadata: {
        user_id:       user.id,
        plan_tier:     plan,
        billing_cycle: billing,
      },
      callback_url: callbackUrl,
    }),
  });

  const json = await paystackRes.json() as {
    status: boolean;
    data?: { authorization_url: string; reference: string };
    message?: string;
  };

  if (!paystackRes.ok || !json.status || !json.data) {
    return err(json.message ?? "Failed to initialize payment", 500);
  }

  return ok({
    authorization_url: json.data.authorization_url,
    reference:         json.data.reference,
  });
}
