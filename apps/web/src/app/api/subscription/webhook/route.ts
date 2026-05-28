import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@studyhub/database";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ ok: false }, { status: 500 });

  const rawBody  = await request.text();
  const sig      = request.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");

  if (sig !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Idempotency — reject duplicate webhook events from Paystack retries
  const { createAdminClient } = await import("@studyhub/database");
  const admin = createAdminClient();
  const eventId = (event as { id?: string }).id ?? `${rawBody.slice(0, 64)}`;
  const { data: alreadyProcessed } = await admin
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (alreadyProcessed) return NextResponse.json({ ok: true, skipped: true });
  await admin.from("processed_webhook_events").insert({ event_id: eventId }).catch(() => {});

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.event) {
      case "subscription.create": {
        const d  = event.data as { subscription_code: string; customer: { id: number }; plan: { plan_code: string } };
        const meta = (event.data as { metadata?: { user_id?: string; plan_tier?: string; billing_cycle?: string } }).metadata;
        if (meta?.user_id) {
          const billing  = meta.billing_cycle ?? "monthly";
          const days     = billing === "annual" ? 365 : 30;
          const expires  = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          await admin
            .from("users")
            .update({
              subscription_tier:           meta.plan_tier ?? "popular",
              subscription_status:         "active",
              subscription_expires_at:     expires,
              paystack_customer_id:        String(d.customer.id),
              paystack_subscription_code:  d.subscription_code,
            })
            .eq("id", meta.user_id);
        }
        break;
      }

      case "subscription.disable": {
        const d = event.data as { subscription_code: string };
        await admin
          .from("users")
          .update({
            subscription_tier:           "free",
            subscription_status:         null,
            subscription_expires_at:     null,
            paystack_subscription_code:  null,
          })
          .eq("paystack_subscription_code", d.subscription_code);
        break;
      }

      case "charge.success": {
        const d    = event.data as { metadata?: { user_id?: string; billing_cycle?: string } };
        const uid  = d.metadata?.user_id;
        if (uid) {
          const days    = d.metadata?.billing_cycle === "annual" ? 365 : 30;
          const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          await admin
            .from("users")
            .update({ subscription_status: "active", subscription_expires_at: expires })
            .eq("id", uid);
        }
        break;
      }

      case "invoice.payment_failed": {
        const d = event.data as { subscription?: { subscription_code: string } };
        if (d.subscription?.subscription_code) {
          await admin
            .from("users")
            .update({ subscription_status: "past_due" })
            .eq("paystack_subscription_code", d.subscription.subscription_code);
        }
        break;
      }
    }
  } catch (err) {
    console.error("[webhook] Handler error:", err);
    // Still return 200 — Paystack retries on non-2xx responses
  }

  return NextResponse.json({ ok: true });
}
