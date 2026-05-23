import { createClient, requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@studyhub/database";
import { ok, err } from "@/lib/response";

export async function POST() {
  const supabase = await createClient();
  const { user, authErr } = await requireUser(supabase);
  if (authErr) return authErr;

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return err("Paystack not configured", 500);

  const admin = createAdminClient();

  const { data: userRow } = await admin
    .from("users")
    .select("paystack_subscription_code")
    .eq("id", user.id)
    .maybeSingle();

  const subCode = userRow?.paystack_subscription_code;
  if (!subCode) return err("No active subscription found", 404);

  // Fetch subscription to get email_token required by Paystack disable API
  const fetchRes = await fetch(
    `https://api.paystack.co/subscription/${encodeURIComponent(subCode)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const fetchJson = await fetchRes.json() as {
    status: boolean;
    data?: { email_token: string };
  };

  if (!fetchRes.ok || !fetchJson.status || !fetchJson.data) {
    return err("Failed to fetch subscription details", 502);
  }

  const disableRes = await fetch("https://api.paystack.co/subscription/disable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: subCode, token: fetchJson.data.email_token }),
  });

  const disableJson = await disableRes.json() as { status: boolean; message?: string };
  if (!disableRes.ok || !disableJson.status) {
    return err(disableJson.message ?? "Failed to cancel subscription", 502);
  }

  await admin
    .from("users")
    .update({ subscription_status: "cancelled" })
    .eq("id", user.id);

  return ok({ success: true });
}
