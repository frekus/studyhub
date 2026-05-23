import { NextResponse } from "next/server";
import { createAdminClient } from "@studyhub/database";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(new URL("/pricing?error=missing_reference", APP_URL));
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.redirect(new URL("/pricing?error=not_configured", APP_URL));
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );

  const json = await verifyRes.json() as {
    status: boolean;
    data?: {
      status: string;
      customer: { id: number; email: string };
      metadata: { user_id?: string; plan_tier?: string; billing_cycle?: string };
      subscription?: { subscription_code: string; email_token: string };
    };
  };

  if (!verifyRes.ok || !json.status || json.data?.status !== "success") {
    return NextResponse.redirect(new URL("/pricing?error=payment_failed", APP_URL));
  }

  const { metadata, customer, subscription } = json.data;
  const userId      = metadata.user_id;
  const planTier    = metadata.plan_tier ?? "popular";
  const billing     = metadata.billing_cycle ?? "monthly";

  if (!userId) {
    return NextResponse.redirect(new URL("/pricing?error=missing_user", APP_URL));
  }

  const daysToAdd   = billing === "annual" ? 365 : 30;
  const expiresAt   = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  await admin
    .from("users")
    .update({
      subscription_tier:            planTier,
      subscription_status:          "active",
      subscription_expires_at:      expiresAt,
      paystack_customer_id:         String(customer.id),
      paystack_subscription_code:   subscription?.subscription_code ?? null,
    })
    .eq("id", userId);

  return NextResponse.redirect(new URL("/dashboard?upgraded=true", APP_URL));
}
