"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen, Brain, Zap, TrendingUp, Users, FileText, Upload,
  ChevronDown, Play, Check, X, Star, Loader2, Menu, Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { AvatarDropdown } from "@/components/avatar-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillingCycle = "monthly" | "annual";

// ---------------------------------------------------------------------------
// Nav dropdown data
// ---------------------------------------------------------------------------

const NAV_FEATURES = [
  { icon: FileText, label: "Smart Notes",       desc: "Create & organise notes with AI summaries" },
  { icon: Zap,      label: "AI Flashcards",     desc: "Auto-generated from every note" },
  { icon: TrendingUp, label: "Exam Predictions", desc: "Predict questions from past papers" },
  { icon: Users,    label: "Study Groups",      desc: "Collaborate with classmates" },
];

const NAV_RESOURCES = [
  { label: "Documentation", href: "#" },
  { label: "Blog",          href: "#" },
  { label: "FAQ",           href: "#faq" },
];

// ---------------------------------------------------------------------------
// NavDropdown
// ---------------------------------------------------------------------------

function NavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-50 min-w-56 rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing feature rows
// ---------------------------------------------------------------------------

//const PRICING_ROWS = [
const PRICING_ROWS: Array<{ label: string; free: string | boolean; popular: string | boolean; pro: string | boolean }> = [
  { label: "Notes per month",          free: "10",       popular: "Unlimited", pro: "Unlimited" },
  { label: "AI summaries per month",   free: "5",        popular: "Unlimited", pro: "Unlimited" },
  { label: "Flashcard sets per month", free: "5",        popular: "Unlimited", pro: "Unlimited" },
  { label: "Exam predictions",         free: false,      popular: "3 / month", pro: "Unlimited" },
  { label: "Study groups",             free: false,      popular: true,        pro: true        },
  { label: "Priority support",         free: false,      popular: false,       pro: true        },
  { label: "Early feature access",     free: false,      popular: false,       pro: true        },
//] as const;
];

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const FAQS = [
  {
    q: "How does AI summary work?",
    a: "When you create or upload a note, StudyHub sends the content to our AI model which reads it and returns a concise 2–3 sentence summary highlighting the most important concepts. It appears automatically within seconds of saving your note.",
  },
  {
    q: "Can I upload PDFs and images?",
    a: "Yes. StudyHub accepts .pdf, .txt, .png, .jpg, and .jpeg files up to 10 MB. Our AI extracts the text content and generates predictions and summaries from it.",
  },
  {
    q: "How accurate are exam predictions?",
    a: "Based on user feedback, predictions are 70–80% accurate. The AI analyses patterns across your uploaded past questions to surface the most likely topics and question formats for your next exam.",
  },
  {
    q: "How do study groups work?",
    a: "Create a group, copy the invite ID, and share it with your classmates. Any member can share one of their notes into the group, making it visible to everyone. Available on Popular and Pro plans.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes — cancel with one click from your Account Settings page. Your plan remains active until the end of the current billing period, then automatically reverts to the free tier. No hidden fees.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted at rest and in transit. Your notes are private by default and never shared with third parties. We use Supabase with row-level security so each user can only access their own data.",
  },
];

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn]     = useState(false);
  const [userEmail, setUserEmail]       = useState("");
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [billing, setBilling]           = useState<BillingCycle>("monthly");
  const [openFaq, setOpenFaq]           = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<"popular" | "pro" | null>(null);
  const [checkoutError, setCheckoutError]     = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { data?: { user?: { id?: string; email?: string } } }) => {
        if (data?.data?.user?.id) {
          setIsLoggedIn(true);
          setUserEmail(data.data.user.email ?? "");
        }
      })
      .catch(() => {});
  }, []);

  async function handleUpgrade(plan: "popular" | "pro") {
    if (!isLoggedIn) { window.location.href = "/signup"; return; }
    setCheckoutError("");
    setCheckoutLoading(plan);
    try {
      const res  = await fetch("/api/subscription/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const json = await res.json() as { data?: { authorization_url: string }; error?: string };
      if (!res.ok || !json.data) { setCheckoutError(json.error ?? "Failed to start checkout"); return; }
      window.location.href = json.data.authorization_url;
    } catch {
      setCheckoutError("Network error. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  const popularPrice = billing === "monthly" ? "₦5,000" : "₦50,000";
  const proPrice     = billing === "monthly" ? "₦10,000" : "₦100,000";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── NAVIGATION ── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="text-xl font-bold text-orange-400">StudyHub</span>
          </Link>

          {/* Desktop centre links */}
          <div className="hidden items-center gap-6 lg:flex">
            <NavDropdown label="Features">
              <div className="p-2">
                {NAV_FEATURES.map(({ icon: Icon, label, desc }) => (
                  <Link key={label} href="/#features" className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-400/10">
                      <Icon className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </NavDropdown>

            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How It Works</a>
            <Link href="/pricing"   className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>

            <NavDropdown label="Resources">
              <div className="p-2">
                {NAV_RESOURCES.map(({ label, href }) => (
                  <Link key={label} href={href} className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
                    {label}
                  </Link>
                ))}
              </div>
            </NavDropdown>

            <a href="#about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">About</a>
          </div>

          {/* Desktop right */}
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            {isLoggedIn ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <AvatarDropdown email={userEmail} />
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/signup">Start Free Today →</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            {isLoggedIn && <AvatarDropdown email={userEmail} />}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-border/60 bg-background px-6 pb-6 pt-4 lg:hidden">
            <div className="space-y-1">
              {[
                { label: "Features",     href: "/#features" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "Pricing",      href: "/pricing" },
                { label: "FAQ",          href: "#faq" },
                { label: "About",        href: "#about" },
              ].map(({ label, href }) => (
                <Link key={label} href={href} onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {label}
                </Link>
              ))}
            </div>
            {!isLoggedIn && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
                <Button variant="outline" asChild><Link href="/login">Log In</Link></Button>
                <Button asChild><Link href="/signup">Start Free Today →</Link></Button>
              </div>
            )}
            {isLoggedIn && (
              <div className="mt-4 border-t border-border/60 pt-4">
                <Button variant="outline" className="w-full" asChild><Link href="/dashboard">Dashboard</Link></Button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-6 py-20 lg:py-28">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">

          {/* Left */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 text-sm font-medium text-orange-400">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Study Platform
            </div>
            <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Study Less.<br />
              <span className="text-orange-400">Learn More.</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Turn your notes, PDFs, and past exams into summaries, flashcards, and predictions — instantly.
            </p>

            {/* CTAs */}
            <div className="mt-8">
              {isLoggedIn ? (
                <Button size="lg" asChild>
                  <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <Button size="lg" asChild>
                      <Link href="/signup">Start for free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="/login"><Play className="mr-1.5 h-4 w-4" />Sign in</Link>
                    </Button>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    No credit card required · Free forever plan
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="hidden lg:block">
            <div className="relative rounded-2xl border border-[#286A63]/60 bg-[#0D2B27] p-6 shadow-2xl shadow-[#14B8A7]/10">
              {/* Teal glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#14B8A7]/5 to-transparent" />

              <p className="text-sm font-medium text-[#95A3A1]">Good morning, Student 👋</p>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { val: "18h 42m", lbl: "Studied" },
                  { val: "32",      lbl: "Notes" },
                  { val: "87%",     lbl: "Pass Rate" },
                ].map(({ val, lbl }) => (
                  <div key={lbl} className="rounded-xl bg-[#071A18]/60 px-3 py-3 text-center">
                    <p className="text-lg font-bold text-[#14B8A7]">{val}</p>
                    <p className="text-xs text-[#95A3A1]">{lbl}</p>
                  </div>
                ))}
              </div>

              {/* Mini note card */}
              <div className="mt-4 rounded-xl border border-[#286A63]/50 bg-[#071A18]/50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#F0FAFA]">Cell Biology — Chapter 4</p>
                  <span className="flex items-center gap-1 rounded-full bg-[#14B8A7]/20 px-2 py-0.5 text-xs text-[#14B8A7]">
                    <Check className="h-3 w-3" />AI Summary Ready
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#95A3A1]">
                  Mitochondria produce ATP via oxidative phosphorylation. The electron transport chain generates a proton gradient across the inner membrane…
                </p>
              </div>

              {/* Flashcard preview */}
              <div className="mt-3 rounded-xl border border-[#286A63]/50 bg-[#0A524C]/30 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#14B8A7]">Flashcard Preview</p>
                <p className="mt-1.5 text-sm text-[#F0FAFA]">Q: What is the powerhouse of the cell?</p>
                <p className="mt-1 text-xs text-[#95A3A1]">Tap to reveal answer…</p>
              </div>

              {/* Decorative dots */}
              <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full border-2 border-[#14B8A7]/40 bg-[#14B8A7]/10" />
              <div className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full border border-[#14B8A7]/30 bg-[#14B8A7]/5" />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-border/60 bg-muted/20 px-6 py-10">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { value: "10,000+",   label: "Students" },
            { value: "500,000+",  label: "Notes Created" },
            { value: "2M+",       label: "Flashcards Generated" },
            { value: "98%",       label: "Pass Rate Improvement" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-orange-400">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CHALLENGES ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">The Challenges</p>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Studying is <span className="text-orange-400">hard.</span> We make it easier.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileText,   title: "Too Much to Cover",   body: "Textbooks and lecture notes pile up faster than you can read them." },
              { icon: Brain,      title: "Hard to Retain",      body: "You read for hours but forget most of it before the exam." },
              { icon: TrendingUp, title: "Wasted Study Time",   body: "Spending hours studying but still not feeling exam-ready." },
              { icon: Users,      title: "Studying Alone",      body: "Hard to stay motivated and on track without guidance or peers." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 [border-top:2px_solid_rgb(var(--accent)_/_0.6)]">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400/10">
                  <Icon className="h-5 w-5 text-orange-400" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">How It Works</p>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            From notes to <span className="text-orange-400">results</span> in four simple steps.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { num: "01", title: "Organise",        body: "Upload PDFs, images, or type your notes directly into StudyHub." },
              { num: "02", title: "AI Processes",    body: "Get instant summaries and a set of flashcards generated from your content." },
              { num: "03", title: "Study Smarter",   body: "Review flashcards and AI exam predictions to focus your revision." },
              { num: "04", title: "Ace Your Exams",  body: "Walk into the exam confident — track progress and improve each week." },
            ].map(({ num, title, body }, i) => (
              <div key={num} className="relative rounded-2xl border border-border/60 bg-card p-6">
                {i < 3 && (
                  <div className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background lg:flex">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  </div>
                )}
                <p className="mb-4 text-4xl font-bold text-orange-400/30">{num}</p>
                <p className="mb-2 font-semibold">{title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">Powerful Tools</p>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you <span className="text-orange-400">need</span> after uploading your notes.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

            {/* AI Summariser */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Original note → Summary</p>
                <div className="space-y-1.5">
                  {["• ATP produced via oxidative phosphorylation", "• Electron chain creates proton gradient", "• Net yield: 36–38 ATP per glucose"].map((l) => (
                    <p key={l} className="rounded bg-orange-400/10 px-2 py-0.5 text-xs text-orange-400">{l}</p>
                  ))}
                </div>
              </div>
              <p className="font-semibold">AI Summariser</p>
              <p className="mt-1 text-sm text-muted-foreground">Condenses any note into key bullet points in seconds.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

            {/* Flashcards */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <div className="rounded-lg border border-orange-400/20 bg-orange-400/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-orange-400">Question</p>
                  <p className="mt-1 text-sm">What is the powerhouse of the cell?</p>
                </div>
                <div className="mt-2 rounded-lg border border-border/40 bg-muted/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Answer</p>
                  <p className="mt-1 text-sm text-muted-foreground">The mitochondria — produces ATP via cellular respiration.</p>
                </div>
              </div>
              <p className="font-semibold">Smart Flashcards</p>
              <p className="mt-1 text-sm text-muted-foreground">5 flashcards auto-generated from every note you create.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

            {/* Exam Predictions */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">Describe the process of osmosis in plant cells.</p>
                  <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-500">High</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Topic: Cell Biology · Likelihood: High</p>
              </div>
              <p className="font-semibold">Exam Predictions</p>
              <p className="mt-1 text-sm text-muted-foreground">Upload past papers. AI predicts the most likely questions.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

            {/* Study Groups */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Biology Study Squad · 4 members</p>
                {["Chapter 3 — Genetics (shared by Amaka)", "Past Questions 2023 (shared by Chidi)"].map((n) => (
                  <div key={n} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 mb-1">
                    <FileText className="h-3 w-3 text-orange-400 shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">{n}</p>
                  </div>
                ))}
              </div>
              <p className="font-semibold">Study Groups</p>
              <p className="mt-1 text-sm text-muted-foreground">Create groups, invite classmates, and share notes together.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

            {/* Progress Tracking */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-2">This week</p>
                <div className="flex items-end gap-1 h-12">
                  {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-orange-400/30" style={{ height: `${h}%` }}>
                      <div className="w-full rounded-t bg-orange-400" style={{ height: i === 5 ? "100%" : "40%" }} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-sm font-bold text-orange-400">18h 42m <span className="text-xs font-normal text-muted-foreground">studied this week</span></p>
              </div>
              <p className="font-semibold">Progress Tracking</p>
              <p className="mt-1 text-sm text-muted-foreground">See study time, flashcard scores, and weak spots at a glance.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

            {/* Multi-format Upload */}
            <div className="group rounded-2xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-orange-400/30">
              <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <div className="flex items-center justify-center gap-3 py-2">
                  {[["PDF", "bg-red-500/20 text-red-400"], ["PNG", "bg-blue-500/20 text-blue-400"], ["TXT", "bg-green-500/20 text-green-400"], ["JPG", "bg-yellow-500/20 text-yellow-400"]].map(([fmt, cls]) => (
                    <div key={fmt} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-bold", cls)}>{fmt}</div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-orange-400/30 py-2">
                  <Upload className="h-4 w-4 text-orange-400" />
                  <span className="text-xs text-orange-400">Drop file to upload</span>
                </div>
              </div>
              <p className="font-semibold">Multi-format Upload</p>
              <p className="mt-1 text-sm text-muted-foreground">Upload PDF, PNG, JPG, or TXT files up to 10 MB each.</p>
              <Link href="/signup" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-400 hover:underline">Try it <ArrowRight className="h-3 w-3" /></Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">Pricing</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing. Unbeatable value.</h2>
          <p className="mt-3 text-muted-foreground">Start free, upgrade when you need more.</p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-muted p-1">
            {(["monthly", "annual"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors capitalize",
                  billing === b ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {b}
                {b === "annual" && <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">Save 17%</span>}
              </button>
            ))}
          </div>

          {checkoutError && (
            <p className="mt-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{checkoutError}</p>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Free */}
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-2 text-4xl font-bold">₦0</p>
              <p className="mt-1 text-sm text-muted-foreground">Free forever</p>
              <Button className="mt-5 w-full" variant="outline" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <ul className="mt-6 space-y-2.5">
                {PRICING_ROWS.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="shrink-0 text-sm font-medium">
                      {row.free === false ? <X className="h-4 w-4 text-muted-foreground" /> : row.free === true ? <Check className="h-4 w-4 text-green-500" /> : row.free}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Popular */}
            <div className="relative rounded-2xl border-2 border-orange-400 bg-card p-6 shadow-lg shadow-orange-400/10">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-semibold text-white">Most Popular</span>
              <p className="text-sm font-medium text-muted-foreground">Popular</p>
              <p className="mt-2 text-4xl font-bold">{popularPrice}</p>
              <p className="mt-1 text-sm text-muted-foreground">per {billing === "monthly" ? "month" : "year"}{billing === "annual" && <span className="ml-1 text-green-500">(₦4,167/mo)</span>}</p>
              <Button className="mt-5 w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => handleUpgrade("popular")} disabled={checkoutLoading !== null}>
                {checkoutLoading === "popular" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Upgrade to Popular
              </Button>
              <ul className="mt-6 space-y-2.5">
                {PRICING_ROWS.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="shrink-0 text-sm font-medium">
                      {row.popular === false ? <X className="h-4 w-4 text-muted-foreground" /> : row.popular === true ? <Check className="h-4 w-4 text-green-500" /> : row.popular}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-border/60 bg-card p-6">
              <p className="text-sm font-medium text-muted-foreground">Pro</p>
              <p className="mt-2 text-4xl font-bold">{proPrice}</p>
              <p className="mt-1 text-sm text-muted-foreground">per {billing === "monthly" ? "month" : "year"}{billing === "annual" && <span className="ml-1 text-green-500">(₦8,333/mo)</span>}</p>
              <Button className="mt-5 w-full" variant="outline" onClick={() => handleUpgrade("pro")} disabled={checkoutLoading !== null}>
                {checkoutLoading === "pro" && <Loader2 className="h-4 w-4 animate-spin" />}
                Upgrade to Pro
              </Button>
              <ul className="mt-6 space-y-2.5">
                {PRICING_ROWS.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="shrink-0 text-sm font-medium">
                      {row.pro === false ? <X className="h-4 w-4 text-muted-foreground" /> : row.pro === true ? <Check className="h-4 w-4 text-green-500" /> : row.pro}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-10 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">Loved by Students</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { quote: "StudyHub helped me pass my WAEC with flying colours. The exam predictions were scary accurate!", name: "Chidi O.", school: "Lagos State University" },
              { quote: "I used to spend 6 hours studying. Now I spend 2 hours and retain more. The AI summaries are incredible.", name: "Amaka N.", school: "University of Ibadan" },
              { quote: "Created a study group with my coursemates and we all shared notes. Best study tool I've ever used.", name: "Emeka A.", school: "University of Lagos" },
            ].map(({ quote, name, school }) => (
              <div key={name} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{quote}&rdquo;</p>
                <div className="mt-4">
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs text-muted-foreground">{school}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-orange-400">Frequently Asked Questions</p>
          <h2 className="mb-10 text-3xl font-bold tracking-tight sm:text-4xl">Got questions? We have answers.</h2>
          <div className="space-y-2">
            {FAQS.map(({ q, a }, i) => {
              const num = String(i + 1).padStart(2, "0");
              const isOpen = openFaq === i;
              return (
                <div key={q} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                  <button
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                  >
                    <span className="shrink-0 text-sm font-bold text-orange-400">{num}</span>
                    <span className="flex-1 font-medium">{q}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 px-5 pb-5 pt-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden px-6 py-24 text-center" id="about">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        {/* Sparkle decorations */}
        <Sparkles className="absolute left-1/4 top-8 h-5 w-5 text-orange-400/30" />
        <Sparkles className="absolute right-1/4 top-12 h-4 w-4 text-orange-400/20" />
        <Sparkles className="absolute bottom-10 left-1/3 h-4 w-4 text-orange-400/20" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">Ready to study smarter?</h2>
          <p className="mt-4 text-lg text-muted-foreground">Join thousands of students already learning with StudyHub.</p>
          <div className="mt-8">
            {isLoggedIn ? (
              <Button size="lg" asChild>
                <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            ) : (
              <Button size="lg" asChild>
                <Link href="/signup">Start Free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free plan available · No credit card required · Cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
