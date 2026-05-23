"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, Users, Zap, FileText, TrendingUp, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { data?: { user?: { email?: string } } }) => {
        console.log("Auth check result:", data);
        if (data?.data?.user?.email) {
          setIsLoggedIn(true);
          setUserEmail(data.data.user.email);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader isLoggedIn={isLoggedIn} userEmail={userEmail} />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 text-sm font-medium text-orange-400">
            <Zap className="h-3.5 w-3.5" />
            AI-powered study companion
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Study smarter,{" "}
            <span className="text-orange-400">not harder</span>
          </h1>
          <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
            StudyHub transforms your notes into flashcards, AI summaries, and exam predictions
            — so you can focus on understanding, not memorizing.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No credit card required · Free forever plan</p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { value: "10k+", label: "Students" },
            { value: "500k+", label: "Notes created" },
            { value: "2M+", label: "Flashcards generated" },
            { value: "98%", label: "Pass rate improvement" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-3xl font-bold text-orange-400">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to ace your exams</h2>
            <p className="mt-4 text-muted-foreground">Powerful tools built for modern students</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                title: "Smart Notes",
                desc: "Create and organize your study notes with a clean, distraction-free editor. Tag, search, and retrieve anything instantly.",
              },
              {
                icon: Brain,
                title: "AI Summaries",
                desc: "Get concise AI-generated summaries of your notes in seconds — perfect for quick revision before an exam.",
              },
              {
                icon: Zap,
                title: "Auto Flashcards",
                desc: "StudyHub automatically creates flashcards from your notes so you can quiz yourself and reinforce key concepts.",
              },
              {
                icon: TrendingUp,
                title: "Exam Predictions",
                desc: "Upload past exam papers and let AI predict the most likely questions for your upcoming exam.",
              },
              {
                icon: Users,
                title: "Study Groups",
                desc: "Collaborate with classmates in study groups. Share notes, challenge each other, and learn together.",
              },
              {
                icon: BookOpen,
                title: "Progress Tracking",
                desc: "See how much you've studied each week, track your flashcard scores, and identify weak spots.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-400/40 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400/10">
                  <f.icon className="h-5 w-5 text-orange-400" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">From notes to exam-ready in three steps</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Create a note", desc: "Type or paste your study material into StudyHub's editor." },
              { step: "02", title: "AI does the work", desc: "Summaries and flashcards are generated automatically in the background." },
              { step: "03", title: "Study & ace it", desc: "Review flashcards, read summaries, and check exam predictions." },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400/10 text-xl font-bold text-orange-400">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Loved by students</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                quote: "The AI summaries save me hours every week. I can review an entire chapter in 5 minutes.",
                name: "Amara O.",
                role: "3rd year Medicine",
              },
              {
                quote: "Auto-generated flashcards are a game changer. I went from barely passing to top of my class.",
                name: "Chidi E.",
                role: "2nd year Law",
              },
              {
                quote: "The exam predictions feature is scary accurate. It predicted 7 out of 10 questions on my last paper.",
                name: "Fatima A.",
                role: "Final year Engineering",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-border/60 bg-card p-6">
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-2xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
          </div>
          <div className="space-y-2">
            {[
              {
                q: "Is StudyHub really free?",
                a: "Yes! The free plan gives you 10 notes, 5 AI summaries, and 5 flashcard sets per month — more than enough to get started. Upgrade for unlimited access.",
              },
              {
                q: "How accurate are the exam predictions?",
                a: "Very. Our AI analyzes patterns in past exam papers to surface the most likely topics. Users report 70-80% accuracy on predicting exam questions.",
              },
              {
                q: "Can I cancel my subscription anytime?",
                a: "Yes, cancel with one click from your dashboard. You keep access until the end of your billing period — no hidden fees.",
              },
              {
                q: "Is my data secure?",
                a: "Your notes are private by default. We use industry-standard encryption at rest and in transit. We never sell your data.",
              },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-border/60 bg-card">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium">
                  {faq.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/40 px-5 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to study smarter?</h2>
          <p className="mt-4 text-muted-foreground">Join thousands of students already using StudyHub to get better grades.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Free plan available", "No credit card required", "Cancel anytime"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-orange-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </div>
  );
}
