"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onCreateFirstNote: () => void;
}

const STEPS = [
  {
    icon: "🎓",
    title: "Welcome to StudyHub!",
    body: "Your AI-powered study assistant. Let's show you around in 4 quick steps.",
    cta: "Get Started →",
    extra: null,
  },
  {
    icon: "📝",
    title: "Create Smart Notes",
    body: "Write or paste your study material. StudyHub automatically generates an AI summary and 5 flashcards for every note you create.",
    cta: "Next →",
    extra: "mock-note",
  },
  {
    icon: "🎯",
    title: "Predict Exam Questions",
    body: "Upload past exam papers (PDF, images, or text). Our AI analyzes patterns and predicts the 10 most likely questions for your next exam.",
    cta: "Next →",
    extra: null,
  },
  {
    icon: "👥",
    title: "Study Together",
    body: "Create a study group, invite classmates with your group ID, and share notes with each other.",
    cta: "Next →",
    extra: null,
  },
  {
    icon: "🚀",
    title: "You're all set!",
    body: "Start by creating your first note. Your AI summary and flashcards will be ready in seconds.",
    cta: "Create My First Note →",
    extra: null,
  },
] as const;

function MockNoteCard() {
  return (
    <div className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-left">
      <p className="text-sm font-semibold">Cellular Respiration</p>
      <div className="mt-2.5 rounded-md bg-orange-500/20 px-3 py-2 text-xs text-orange-400 leading-relaxed">
        AI Summary: ATP is produced via glycolysis, the Krebs cycle, and the electron transport chain, yielding up to 38 ATP per glucose molecule.
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
          5 flashcards ready
        </span>
      </div>
    </div>
  );
}

export function OnboardingModal({ open, onClose, onCreateFirstNote }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  function handleCta() {
    if (isLast) {
      onCreateFirstNote();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    setStep(0);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">

        {/* Skip — top right */}
        {!isLast && (
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
        )}

        <div className="px-8 pb-8 pt-10">
          {/* Icon */}
          <div className="mb-5 text-5xl text-center">{current.icon}</div>

          {/* Title */}
          <h2 className="text-center text-2xl font-bold tracking-tight">{current.title}</h2>

          {/* Body */}
          <p className="mt-3 text-center text-sm text-muted-foreground leading-relaxed">
            {current.body}
          </p>

          {/* Extra content */}
          {current.extra === "mock-note" && <MockNoteCard />}

          {/* CTA button */}
          <Button
            className="mt-8 w-full bg-orange-500 text-white hover:bg-orange-600"
            onClick={handleCta}
          >
            {current.cta}
          </Button>

          {/* Skip link on last step */}
          {isLast && (
            <button
              onClick={handleSkip}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          )}

          {/* Progress dots */}
          <div className="mt-6 flex justify-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  i === step
                    ? "w-6 bg-orange-500"
                    : "w-2 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>

          {/* Back on non-first steps */}
          {!isFirst && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
