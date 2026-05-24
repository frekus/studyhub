"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Settings, CreditCard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  email: string;
  plan?: string;
}

export function AvatarDropdown({ email, plan }: Props) {
  const [open, setOpen]           = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);
  const initial                   = email.charAt(0).toUpperCase();

  // Close on outside click
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
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground ring-2 ring-transparent transition-all hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-accent/40"
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-10 z-50 min-w-52 rounded-xl border border-border bg-card shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100",
          )}
        >
          {/* Email header */}
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

          {/* Nav items */}
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
