# Paystack Setup Guide

## 1. Create a Paystack Account

1. Go to [paystack.com](https://paystack.com) and create an account
2. Complete business verification to enable live payments
3. Navigate to **Settings → API Keys & Webhooks** to get your keys

## 2. Create Subscription Plans

Create four plans in the Paystack dashboard (**Products → Plans**):

| Plan Name         | Amount      | Interval |
|------------------|-------------|----------|
| StudyHub Popular Monthly | ₦5,000   | monthly  |
| StudyHub Popular Annual  | ₦50,000  | annually |
| StudyHub Pro Monthly     | ₦10,000  | monthly  |
| StudyHub Pro Annual      | ₦100,000 | annually |

Copy the **Plan Code** for each plan (format: `PLN_xxxxxxxxxx`).

## 3. Configure Environment Variables

Add the following to `apps/web/.env.local`:

```env
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://yourdomain.com

PAYSTACK_POPULAR_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_POPULAR_ANNUAL_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_PRO_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_PRO_ANNUAL_PLAN=PLN_xxxxxxxxxxxx
```

> For local development use `NEXT_PUBLIC_APP_URL=http://localhost:3001`

## 4. Configure Webhook

In the Paystack dashboard (**Settings → API Keys & Webhooks → Webhooks**):

1. Click **Add New Webhook**
2. Set the URL to: `https://yourdomain.com/api/subscription/webhook`
3. The webhook endpoint handles:
   - `subscription.create` — activates the user's plan
   - `subscription.disable` — downgrades user to free
   - `charge.success` — extends subscription on renewal
   - `invoice.payment_failed` — marks subscription as `past_due`

## 5. Database Migrations

Run these SQL statements in your Supabase SQL Editor:

```sql
-- Add subscription fields to the users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_tier      text    NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status    text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paystack_customer_id   text,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code text;

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feature    text        NOT NULL,
  month      text        NOT NULL,  -- 'YYYY-MM'
  count      integer     NOT NULL DEFAULT 0,
  UNIQUE (user_id, feature, month)
);

-- RLS: users can only see their own usage
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON public.usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Allow service role (worker + API) full access
-- (service_role bypasses RLS automatically)

-- Index for fast monthly lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month
  ON public.usage_tracking (user_id, month);
```

## 6. Testing

Use Paystack's test keys (`sk_test_*` / `pk_test_*`) during development.

Test card numbers from [Paystack docs](https://paystack.com/docs/payments/test-payments/):

| Card Number         | Scenario       |
|--------------------|----------------|
| 4084 0840 8408 4081 | Successful payment |
| 4084 0840 8408 4081 (wrong CVV) | Failed payment |

## 7. Flow Summary

```
User clicks "Upgrade to Popular"
  → POST /api/subscription/initialize
  → Redirect to Paystack checkout (authorization_url)
  → User completes payment
  → Paystack redirects to /api/subscription/verify?reference=xxx
  → Subscription activated → redirect to /dashboard?upgraded=true

On renewal:
  → Paystack sends charge.success webhook
  → /api/subscription/webhook extends subscription_expires_at

On cancellation:
  → User clicks "Cancel" in dashboard
  → POST /api/subscription/cancel
  → Paystack subscription disabled
  → Status set to "cancelled", plan remains active until expires_at
```
