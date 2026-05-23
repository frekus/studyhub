export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      notes: 10,
      ai_summaries: 5,
      flashcards: 5,
      exam_predictions: 0,
      study_groups: false,
    },
  },
  popular: {
    name: "Popular",
    monthly_price: 5000,
    annual_price: 50000,
    paystack_monthly_plan_code: process.env.PAYSTACK_POPULAR_MONTHLY_PLAN,
    paystack_annual_plan_code: process.env.PAYSTACK_POPULAR_ANNUAL_PLAN,
    limits: {
      notes: -1,
      ai_summaries: -1,
      flashcards: -1,
      exam_predictions: 3,
      study_groups: true,
    },
  },
  pro: {
    name: "Pro",
    monthly_price: 10000,
    annual_price: 100000,
    paystack_monthly_plan_code: process.env.PAYSTACK_PRO_MONTHLY_PLAN,
    paystack_annual_plan_code: process.env.PAYSTACK_PRO_ANNUAL_PLAN,
    limits: {
      notes: -1,
      ai_summaries: -1,
      flashcards: -1,
      exam_predictions: -1,
      study_groups: true,
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;
