"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Settings, CreditCard, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

// Hardcoded fallback: always show Admin Console for the primary admin account
// regardless of DB query results (guards against RLS / migration timing issues).
const ADMIN_EMAILS = new Set(["kufrekus4@gmail.com"]);

interface Props {
  email: string;
  plan?: string;
}

export function AvatarDropdown({ email, plan }: Props) {
  const [open, setOpen]           = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Seed from the hardcoded set so the link is visible immediately on mount.
  const [isAdmin, setIsAdmin]     = useState(() => ADMIN_EMAILS.has(email));
  const containerRef              = useRef<HTMLDivElement>(null);
  const initial                   = email.charAt(0).toUpperCase();

  useEffect(() => {
    // Primary check: API route uses the service-role key, bypasses RLS.
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((j) => { if (j.data?.isAdmin === true) setIsAdmin(true); })
      .catch(() => {});

    // Secondary check: direct browser-client query as a belt-and-suspenders.
    // Only ever sets isAdmin to true — never overrides the hardcoded fallback.
    async function checkViaSupabase() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .maybeSingle();
        if ((data as { is_admin: boolean } | null)?.is_admin === true) setIsAdmin(true);
      } catch { /* non-critical */ }
    }
    void checkViaSupabase();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground ring-2 ring-transparent transition-all hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-accent/40"
      >
        {initial}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-10 z-50 min-w-52 rounded-xl border border-border bg-card shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          <div className="px-4 py-3">
            <p className="max-w-44 truncate text-xs text-muted-foreground">{email}</p>
            {plan && (
              <span className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                plan === "pro"     && "bg-orange-500/15 text-orange-400",
                plan === "popular" && "bg-accent/15 text-accent",
                plan === "free"    && "bg-muted text-muted-foreground",
              )}>
                {plan}
              </span>
            )}
          </div>

          <div className="border-t border-border/60" />

          <div className="p-1">
            {[
              { icon: LayoutDashboard, label: "Dashboard",       href: "/dashboard" },
              { icon: Settings,        label: "Account Settings", href: "/account"   },
              { icon: CreditCard,      label: "Pricing",          href: "/pricing"   },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>

          {isAdmin && (
            <>
              <div className="border-t border-border/60" />
              <div className="p-1">
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg border-l-2 border-l-teal-500/70 pl-2.5 pr-3 py-2 text-sm font-medium text-teal-600 dark:text-teal-400 transition-colors hover:bg-teal-500/8"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Admin Console
                </Link>
              </div>
            </>
          )}

          <div className="border-t border-border/60" />

          <div className="p-1">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
