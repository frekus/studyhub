"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BookOpen, Check, X, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/footer";

// ---------------------------------------------------------------------------
// Feature rows
// ---------------------------------------------------------------------------

const FEATURE_ROWS = [
  { label: "Notes per month",          free: "10",    popular: "Unlimited", pro: "Unlimited" },
  { label: "AI summaries per month",   free: "5",     popular: "Unlimited", pro: "Unlimited" },
  { label: "Flashcard sets per month", free: "5",     popular: "Unlimited", pro: "Unlimited" },
  { label: "Exam predictions",         free: false,   popular: "3/month",   pro: "Unlimited" },
  { label: "Study groups",             free: false,   popular: true,        pro: true        },
] as const;

function FeatureList({ values }: { values: readonly (string | boolean)[] }) {
  return (
    <ul className="mt-6 flex flex-col">
      {FEATURE_ROWS.map((row, i) => {
        const value = values[i];
        return (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-border/40 py-2 last:border-0"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="shrink-0 text-right text-sm font-medium">
              {value === false ? (
                <X className="h-4 w-4 text-muted-foreground" />
              ) : value === true ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                value
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// PricingContent
// ---------------------------------------------------------------------------

function PricingContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [billing, setBilling]       = useState<"monthly" | "annual">("monthly");
  const [tier, setTier]             = useState<string | null>(null);
  const [loading, setLoading]       = useState<"popular" | "pro" | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) return;
      const j = await res.json() as { data?: { user?: { id: string } } };
      if (j.data?.user?.id) {
        setIsLoggedIn(true);
        const subRes = await fetch("/api/subscription");
        if (subRes.ok) {
          const sj = await subRes.json() as { data?: { tier: string } };
          setTier(sj.data?.tier ?? "free");
        }
      }
    });

    if (searchParams.get("error")) {
      setErrorMsg("Payment could not be processed. Please try again.");
    }
  }, [searchParams]);

  async function handleUpgrade(plan: "popular" | "pro") {
    if (!isLoggedIn) { router.push("/signup"); return; }
    setErrorMsg("");
    setLoading(plan);
    try {
      const res  = await fetch("/api/subscription/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const json = await res.json() as { data?: { authorization_url: string }; error?: string };
      if (!res.ok || !json.data) { setErrorMsg(json.error ?? "Failed to start checkout"); return; }
      window.location.href = json.data.authorization_url;
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const popularPrice = billing === "monthly" ? 5_000  : 50_000;
  const proPrice     = billing === "monthly" ? 10_000 : 100_000;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="font-bold text-orange-400">StudyHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLoggedIn ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" asChild>
                  <Link href="/signup">Sign up free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground">Unlock AI superpowers for your studies. Cancel anytime.</p>

          {errorMsg && (
            <p className="mx-auto mt-4 max-w-sm rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                billing === "monthly"
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                billing === "annual"
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Annual
              <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards — stacked on mobile, 3-col on md+ */}
        <div className="grid gap-6 md:grid-cols-3">

          {/* Free */}
          <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-1 text-4xl font-bold">₦0</p>
              <p className="mt-1 text-sm text-muted-foreground">Free forever</p>
            </div>
            {tier === "free" || !isLoggedIn ? (
              <Button className="w-full" variant="outline" asChild>
                <Link href={isLoggedIn ? "/dashboard" : "/signup"}>
                  {isLoggedIn ? "Current plan" : "Get started free"}
                </Link>
              </Button>
            ) : (
              <Button className="w-full" variant="outline" disabled>Current plan</Button>
            )}
            <FeatureList values={FEATURE_ROWS.map((r) => r.free)} />
          </div>

          {/* Popular */}
          <div className="relative rounded-2xl border-2 border-orange-400 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/10">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-semibold text-white">
              Most Popular
            </span>
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Popular</p>
              <p className="mt-1 text-4xl font-bold">₦{popularPrice.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                per {billing === "monthly" ? "month" : "year"}
                {billing === "annual" && (
                  <span className="ml-1 text-green-500">(₦4,167/mo)</span>
                )}
              </p>
            </div>
            {tier === "popular" ? (
              <Button className="w-full bg-orange-500 text-white hover:bg-orange-600" disabled>
                Current plan
              </Button>
            ) : (
              <Button
                className="w-full bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => handleUpgrade("popular")}
                disabled={loading !== null}
              >
                {loading === "popular"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Zap className="h-4 w-4" />}
                {isLoggedIn ? "Upgrade to Popular" : "Get Popular"}
              </Button>
            )}
            <FeatureList values={FEATURE_ROWS.map((r) => r.popular)} />
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
            <div className="mb-4">
              <p className="text-sm font-medium text-muted-foreground">Pro</p>
              <p className="mt-1 text-4xl font-bold">₦{proPrice.toLocaleString()}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                per {billing === "monthly" ? "month" : "year"}
                {billing === "annual" && (
                  <span className="ml-1 text-green-500">(₦8,333/mo)</span>
                )}
              </p>
            </div>
            {tier === "pro" ? (
              <Button className="w-full" variant="outline" disabled>Current plan</Button>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleUpgrade("pro")}
                disabled={loading !== null}
              >
                {loading === "pro" && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoggedIn ? "Upgrade to Pro" : "Get Pro"}
              </Button>
            )}
            <FeatureList values={FEATURE_ROWS.map((r) => r.pro)} />
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          All plans include a 7-day free trial. Cancel anytime — no questions asked.
          Payments are processed securely by Paystack.
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
