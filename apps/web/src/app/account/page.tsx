"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Lock, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { AvatarDropdown } from "@/components/avatar-dropdown";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageStat { used: number; limit: number }
interface Subscription {
  tier: string;
  status: string | null;
  expires_at: string | null;
  usage: {
    notes:            UsageStat;
    ai_summaries:     UsageStat;
    flashcards:       UsageStat;
    exam_predictions: UsageStat;
  };
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

function UsageBar({ label, stat }: { label: string; stat: UsageStat }) {
  const pct    = stat.limit > 0 ? Math.min(stat.used / stat.limit, 1) : 0;
  const isMax  = pct >= 1;
  const isUnlimited = stat.limit === -1;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isMax && "text-destructive")}>
          {isUnlimited ? "Unlimited" : `${stat.used} / ${stat.limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", isMax ? "bg-destructive" : "bg-accent")}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <h2 className="mb-6 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountPage
// ---------------------------------------------------------------------------

export default function AccountPage() {
  const router = useRouter();

  // User state
  const [email, setEmail]       = useState("");
  const [fullName, setFullName] = useState("");
  const [userId, setUserId]     = useState("");
  const [provider, setProvider] = useState<string | null>(null);

  // Subscription
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  // UI state
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [saveSuccess, setSaveSuccess]       = useState(false);
  const [saveError, setSaveError]           = useState("");
  const [pwLoading, setPwLoading]           = useState(false);
  const [pwMsg, setPwMsg]                   = useState("");
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [deleteInput, setDeleteInput]       = useState("");
  const [deleting, setDeleting]             = useState(false);
  const [cancelSubOpen, setCancelSubOpen]   = useState(false);
  const [cancellingSub, setCancellingSub]   = useState(false);
  const [toast, setToast]                   = useState("");
  const toastTimer                          = useRef<ReturnType<typeof setTimeout>>();

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  // Load on mount
  useEffect(() => {
    async function load() {
      const [meRes, subRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/subscription"),
      ]);

      if (!meRes.ok) { router.replace("/login"); return; }

      const me = await meRes.json() as { data?: { user?: { id: string; email?: string; full_name?: string; identities?: { provider: string }[] } } };
      const u  = me.data?.user;
      if (!u) { router.replace("/login"); return; }

      setUserId(u.id);
      setEmail(u.email ?? "");
      setFullName(u.full_name ?? "");

      // Detect Google OAuth
      const identities = u.identities ?? [];
      const googleId   = identities.find((i: { provider: string }) => i.provider === "google");
      setProvider(googleId ? "google" : null);

      if (subRes.ok) {
        const sj = await subRes.json() as { data?: Subscription };
        if (sj.data) setSubscription(sj.data);
      }

      setLoading(false);
    }
    void load();
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(""); setSaveSuccess(false);
    try {
      const res  = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setSaveError(json.error ?? "Failed to save"); return; }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally { setSaving(false); }
  }

  async function handlePasswordReset() {
    setPwLoading(true); setPwMsg("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setPwMsg(res.ok ? "Password reset email sent — check your inbox." : "Failed to send reset email.");
    } finally { setPwLoading(false); }
  }

  async function handleCancelSubscription() {
    setCancellingSub(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      if (res.ok) {
        setSubscription((prev) => prev ? { ...prev, status: "cancelled" } : null);
        setCancelSubOpen(false);
      }
    } finally { setCancellingSub(false); }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/account", { method: "DELETE" });
      if (res.ok) { router.push("/"); }
    } finally { setDeleting(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tier     = subscription?.tier ?? "free";
  const isPaid   = tier !== "free";
  const isCancelled = subscription?.status === "cancelled";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="font-bold text-orange-400">StudyHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AvatarDropdown email={email} plan={tier} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile, subscription, and security.</p>
        </div>

        {/* ── Profile ── */}
        <Section title="Profile">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-foreground">
              {email.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{fullName || email}</p>
              <button
                onClick={() => showToast("Avatar upload coming soon!")}
                className="mt-1 text-xs text-accent hover:underline"
              >
                Update avatar
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  value={email}
                  readOnly
                  className="pr-9 opacity-60 cursor-not-allowed"
                />
                <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
              </Button>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-green-500">
                  <Check className="h-4 w-4" />Saved
                </span>
              )}
            </div>
          </form>
        </Section>

        {/* ── Subscription ── */}
        <Section title="Subscription">
          <div className="mb-4 flex items-center gap-3">
            <span className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold capitalize",
              tier === "pro"     && "bg-orange-500/15 text-orange-400",
              tier === "popular" && "bg-accent/15 text-accent",
              tier === "free"    && "bg-muted text-muted-foreground",
            )}>
              {tier}
            </span>
            {subscription?.status && subscription.status !== "active" && (
              <span className="text-xs text-muted-foreground capitalize">
                ({subscription.status.replace("_", " ")})
              </span>
            )}
            {subscription?.expires_at && (
              <span className="text-xs text-muted-foreground">
                · {isCancelled ? "Active until" : "Renews"}{" "}
                {new Date(subscription.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {/* Plan bullets */}
          <ul className="mb-5 space-y-1 text-sm text-muted-foreground">
            {tier === "free" && <>
              <li>• 10 notes, 5 AI summaries, 5 flashcard sets per month</li>
              <li>• No exam predictions</li>
              <li>• No study groups</li>
            </>}
            {tier === "popular" && <>
              <li>• Unlimited notes, summaries, and flashcards</li>
              <li>• 3 exam predictions per month</li>
              <li>• Study groups included</li>
            </>}
            {tier === "pro" && <>
              <li>• Everything in Popular</li>
              <li>• Unlimited exam predictions</li>
              <li>• Priority AI processing</li>
            </>}
          </ul>

          {/* Usage this month */}
          {subscription && (
            <div className="mb-5 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Usage this month</p>
              <UsageBar label="AI Summaries" stat={subscription.usage.ai_summaries} />
              <UsageBar label="Flashcard Sets" stat={subscription.usage.flashcards} />
              <UsageBar label="Exam Predictions" stat={subscription.usage.exam_predictions} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!isPaid && (
              <Button size="sm" asChild>
                <Link href="/pricing">Upgrade plan</Link>
              </Button>
            )}
            {isPaid && tier !== "pro" && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/pricing">Upgrade to Pro</Link>
              </Button>
            )}
            {isPaid && !isCancelled && (
              <button
                onClick={() => setCancelSubOpen(true)}
                className="text-sm text-muted-foreground transition-colors hover:text-destructive"
              >
                Cancel subscription
              </button>
            )}
          </div>
        </Section>

        {/* ── Security ── */}
        <Section title="Security">
          <div className="space-y-4">
            {/* Password reset */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">Send a password reset link to your email</p>
              </div>
              <Button variant="outline" size="sm" onClick={handlePasswordReset} disabled={pwLoading}>
                {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change password"}
              </Button>
            </div>
            {pwMsg && (
              <p className={cn("rounded-md px-3 py-2 text-sm", pwMsg.includes("sent") ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive")}>
                {pwMsg}
              </p>
            )}

            {/* Connected accounts */}
            {provider === "google" && (
              <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium">Google</p>
                    <p className="text-xs text-muted-foreground">Connected</p>
                  </div>
                </div>
                <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-500">Active</span>
              </div>
            )}

            {/* Delete account */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border/60 pt-4">
              <div>
                <p className="text-sm font-medium text-destructive">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive" onClick={() => setDeleteOpen(true)}>
                <AlertTriangle className="h-4 w-4" />Delete account
              </Button>
            </div>
          </div>
        </Section>

        {/* ── Preferences ── */}
        <Section title="Preferences">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Study reminders and product updates</p>
            </div>
            <button
              onClick={() => showToast("Email notification settings coming soon!")}
              className="relative h-6 w-10 rounded-full bg-muted transition-colors"
            >
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-muted-foreground/50 transition-transform" />
            </button>
          </div>
        </Section>
      </main>

      {/* Cancel subscription confirm */}
      <ConfirmDialog
        open={cancelSubOpen}
        title="Cancel subscription?"
        description="Your plan stays active until the end of the billing period, then reverts to Free."
        confirmLabel="Cancel subscription"
        onConfirm={handleCancelSubscription}
        onCancel={() => setCancelSubOpen(false)}
        loading={cancellingSub}
      />

      {/* Delete account confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="font-bold">Delete account?</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              This permanently deletes your account, all notes, flashcards, and exam data. This action <strong>cannot be undone</strong>.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="delete-confirm">Type <strong>DELETE</strong> to confirm</Label>
              <Input
                id="delete-confirm"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                disabled={deleteInput !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete my account"}
              </Button>
              <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteInput(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-5 py-2.5 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
