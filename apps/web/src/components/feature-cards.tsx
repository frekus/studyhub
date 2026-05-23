"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Layers, Users, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  guestHref: string;
  authHref: string;
  accent?: boolean;
  badge?: string;
}

const features: Feature[] = [
  {
    icon: FileText,
    title: "Smart Study Notes",
    description:
      "Create and organize your notes with automatic AI summaries that distill complex topics into key insights.",
    guestHref: "/signup",
    authHref: "/dashboard",
  },
  {
    icon: Layers,
    title: "AI Flashcards",
    description:
      "Every note automatically generates 5 study flashcards. Flip through them to test your knowledge.",
    guestHref: "/signup",
    authHref: "/dashboard",
  },
  {
    icon: Users,
    title: "Study Groups",
    description:
      "Create groups, invite classmates, and share notes together. Collaborative studying made simple.",
    guestHref: "/signup",
    authHref: "/dashboard?tab=groups",
  },
  {
    icon: Target,
    title: "Exam Predictions",
    description:
      "Upload past exam questions and let AI predict what's likely to appear on your next exam. Study smarter, not harder.",
    guestHref: "/signup",
    authHref: "/dashboard",
    accent: true,
    badge: "New",
  },
];

export function FeatureCards() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setIsLoggedIn(!!data.session));
  }, []);

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {features.map(({ icon: Icon, title, description, guestHref, authHref, accent, badge }) => {
        const href = isLoggedIn ? authHref : guestHref;
        return (
          <Link
            key={title}
            href={href}
            className={cn(
              "group relative flex flex-col rounded-xl border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
              accent
                ? "border-orange-400/60 hover:border-orange-400"
                : "border-border hover:border-orange-400/40",
            )}
          >
            {badge && (
              <span className="absolute right-3 top-3 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white">
                {badge}
              </span>
            )}
            <div
              className={cn(
                "mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg",
                accent ? "bg-orange-500/20" : "bg-orange-500/10",
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  accent ? "text-orange-400" : "text-orange-400",
                )}
              />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        );
      })}
    </div>
  );
}
