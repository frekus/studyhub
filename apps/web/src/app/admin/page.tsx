"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, CreditCard, Activity, Settings,
  ArrowLeft, Search, ChevronDown, MoreHorizontal,
  Loader2, RefreshCw, Trash2, ShieldOff, ShieldCheck,
  KeyRound, Download, Menu, X, ChevronLeft, ChevronRight,
  TrendingUp, FileText, Zap, Crown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
  notes_count: number;
  last_active: string | null;
}

interface Stats {
  total_users: number;
  new_users_today: number;
  new_users_this_week: number;
  active_users_today: number;
  free_users: number;
  popular_users: number;
  pro_users: number;
  total_notes: number;
  total_exams: number;
  total_flashcards: number;
  revenue_this_month: number;
}

interface UserDetail {
  profile: AdminUser & Record<string, unknown>;
  auth: { email: string; created_at: string; last_sign_in_at: string | null } | null;
  stats: { notes_count: number; flashcards_count: number; exams_count: number; current_streak: number; total_study_days: number };
  recent_notes: { id: string; title: string; created_at: string }[];
}

interface ActivityItem {
  id: string;
  type: string;
  email?: string;
  name?: string;
  plan?: string;
  title?: string;
  user_email?: string;
  created_at: string;
}

type NavTab = "dashboard" | "users" | "subscriptions" | "activity" | "settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

const PLAN_COLORS: Record<string, string> = {
  free:    "bg-[#1a3330] text-[#6ee7b7]",
  popular: "bg-[#0f3030] text-[#2dd4bf]",
  pro:     "bg-[#3d1a00] text-[#fb923c]",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-900/40 text-green-400",
  cancelled: "bg-gray-800 text-gray-400",
  past_due:  "bg-yellow-900/40 text-yellow-400",
  suspended: "bg-red-900/40 text-red-400",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", PLAN_COLORS[plan] ?? PLAN_COLORS.free)}>
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_COLORS[status] ?? STATUS_COLORS.cancelled)}>
      {status}
    </span>
  );
}

function Avatar({ email, plan, size = 8 }: { email: string; plan?: string; size?: number }) {
  const colors: Record<string, string> = { pro: "bg-orange-600", popular: "bg-teal-600", free: "bg-slate-600" };
  const bg = colors[plan ?? "free"] ?? colors.free;
  const s  = `h-${size} w-${size}`;
  return (
    <div className={cn("flex items-center justify-center rounded-full text-white font-semibold", s, bg)}
      style={{ fontSize: size * 2 }}>
      {email.charAt(0).toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, color = "teal" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: "teal" | "orange" | "green" | "blue";
}) {
  const colors = {
    teal:   "text-teal-400 bg-teal-900/30",
    orange: "text-orange-400 bg-orange-900/30",
    green:  "text-green-400 bg-green-900/30",
    blue:   "text-blue-400 bg-blue-900/30",
  };
  return (
    <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#6b8f88] uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-white">{typeof value === "number" ? fmtNumber(value) : value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#6b8f88]">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserDetailSlideOver
// ---------------------------------------------------------------------------

function UserDetailSlideOver({ userId, onClose, onUpdated }: {
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail]   = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName]   = useState(false);
  const [nameVal, setNameVal]     = useState("");
  const [savingName, setSavingName] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((j) => { setDetail(j.data ?? null); setNameVal(j.data?.profile?.full_name ?? ""); })
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleAction(action: string) {
    setBusy(true); setActionMsg("");
    try {
      const method = action === "delete" ? "DELETE" : "POST";
      const path   = action === "delete"
        ? `/api/admin/users/${userId}`
        : `/api/admin/users/${userId}/${action}`;
      const res = await fetch(path, { method });
      if (res.ok) {
        if (action === "delete") { onUpdated(); onClose(); return; }
        setActionMsg(`Action "${action}" completed.`);
        onUpdated();
        // Refresh detail
        const r2 = await fetch(`/api/admin/users/${userId}`);
        const j2 = await r2.json();
        setDetail(j2.data ?? null);
      }
    } finally { setBusy(false); }
  }

  async function saveName() {
    if (!nameVal.trim()) return;
    setSavingName(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: nameVal.trim() }),
    });
    if (res.ok) {
      setEditName(false);
      onUpdated();
      setDetail((prev) => prev ? { ...prev, profile: { ...prev.profile, full_name: nameVal.trim() } } : prev);
    }
    setSavingName(false);
  }

  async function changePlan(plan: string) {
    setBusy(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_tier: plan }),
    });
    const r = await fetch(`/api/admin/users/${userId}`);
    const j = await r.json();
    setDetail(j.data ?? null);
    onUpdated();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-lg overflow-y-auto bg-[#071A18] border-l border-[#1a3330] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a3330] px-6 py-4">
          <h2 className="text-base font-semibold text-white">User Detail</h2>
          <button onClick={onClose} className="text-[#6b8f88] hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : !detail ? (
          <p className="p-6 text-[#6b8f88]">User not found.</p>
        ) : (
          <div className="flex-1 space-y-6 p-6">
            {/* Profile header */}
            <div className="flex items-start gap-4">
              <Avatar email={detail.auth?.email ?? ""} plan={detail.profile.subscription_tier as string} size={16} />
              <div className="flex-1 min-w-0">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameVal} onChange={(e) => setNameVal(e.target.value)}
                      className="flex-1 rounded-md border border-[#1a3330] bg-[#0D2B27] px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button onClick={saveName} disabled={savingName} className="text-xs text-teal-400 hover:text-teal-300">Save</button>
                    <button onClick={() => setEditName(false)} className="text-xs text-[#6b8f88] hover:text-white">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white truncate">{detail.profile.full_name as string ?? "—"}</p>
                    <button onClick={() => setEditName(true)} className="text-[10px] text-teal-500 hover:text-teal-300">edit</button>
                  </div>
                )}
                <p className="text-sm text-[#6b8f88] truncate">{detail.auth?.email}</p>
                <div className="mt-1.5 flex gap-2">
                  <PlanBadge plan={detail.profile.subscription_tier as string} />
                  <StatusBadge status={detail.profile.subscription_status as string} />
                </div>
              </div>
            </div>

            {actionMsg && (
              <div className="rounded-lg bg-teal-900/30 border border-teal-700/30 px-3 py-2 text-sm text-teal-400">{actionMsg}</div>
            )}

            {/* Account info */}
            <Section title="Account Info">
              <Row label="Joined" value={fmtDate(detail.profile.created_at as string)} />
              <Row label="Last sign in" value={detail.auth?.last_sign_in_at ? relativeTime(detail.auth.last_sign_in_at) : "Never"} />
              <Row label="User ID" value={<code className="text-[10px] text-[#6b8f88]">{detail.profile.id as string}</code>} />
            </Section>

            {/* Subscription */}
            <Section title="Subscription">
              <Row label="Plan" value={<PlanBadge plan={detail.profile.subscription_tier as string} />} />
              <Row label="Status" value={<StatusBadge status={detail.profile.subscription_status as string} />} />
              <Row label="Expires" value={detail.profile.subscription_expires_at ? fmtDate(detail.profile.subscription_expires_at as string) : "Never (free)"} />
              <div className="pt-2 flex flex-wrap gap-2">
                {["free", "popular", "pro"].map((plan) => (
                  <button key={plan} onClick={() => changePlan(plan)} disabled={busy}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      detail.profile.subscription_tier === plan
                        ? "bg-teal-600 text-white"
                        : "bg-[#0D2B27] border border-[#1a3330] text-[#6b8f88] hover:text-white hover:border-teal-700"
                    )}>
                    {plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </button>
                ))}
              </div>
            </Section>

            {/* Usage stats */}
            <Section title="Usage Stats">
              <Row label="Notes created" value={detail.stats.notes_count} />
              <Row label="Flashcards reviewed" value={detail.stats.flashcards_count} />
              <Row label="Exams uploaded" value={detail.stats.exams_count} />
              <Row label="Current streak" value={`${detail.stats.current_streak} days`} />
              <Row label="Total study days" value={detail.stats.total_study_days} />
            </Section>

            {/* Recent notes */}
            {detail.recent_notes.length > 0 && (
              <Section title="Recent Notes">
                <div className="space-y-1.5">
                  {detail.recent_notes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between rounded-lg bg-[#0D2B27] px-3 py-2">
                      <p className="text-sm text-white truncate">{n.title}</p>
                      <p className="text-xs text-[#6b8f88] shrink-0 ml-2">{fmtDate(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Quick actions */}
            <Section title="Quick Actions">
              <div className="flex flex-col gap-2">
                <ActionBtn icon={KeyRound} label="Send Password Reset" onClick={() => handleAction("reset-password")} disabled={busy} />
                {detail.profile.subscription_status === "suspended" ? (
                  <ActionBtn icon={ShieldCheck} label="Unsuspend Account" onClick={() => handleAction("unsuspend")} disabled={busy} variant="success" />
                ) : (
                  <ActionBtn icon={ShieldOff} label="Suspend Account" onClick={() => handleAction("suspend")} disabled={busy} variant="danger" />
                )}
                {confirmDelete ? (
                  <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 space-y-2">
                    <p className="text-sm text-red-400">Delete this account permanently?</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleAction("delete")} disabled={busy}
                        className="flex-1 rounded-md bg-red-600 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors">
                        {busy ? "Deleting…" : "Yes, Delete"}
                      </button>
                      <button onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-md border border-[#1a3330] py-1.5 text-sm text-[#6b8f88] hover:text-white transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <ActionBtn icon={Trash2} label="Delete Account" onClick={() => setConfirmDelete(true)} disabled={busy} variant="danger" />
                )}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b8f88]">{title}</p>
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27] divide-y divide-[#1a3330] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-sm text-[#6b8f88]">{label}</p>
      <div className="text-sm text-white">{value}</div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, disabled, variant = "default" }: {
  icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean;
  variant?: "default" | "danger" | "success";
}) {
  const colors = {
    default: "border-[#1a3330] text-white hover:border-teal-700 hover:text-teal-300",
    danger:  "border-red-800/40 text-red-400 hover:border-red-700 hover:bg-red-900/20",
    success: "border-green-800/40 text-green-400 hover:border-green-700 hover:bg-green-900/20",
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={cn("flex w-full items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition-colors disabled:opacity-50", colors[variant])}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// UserRowMenu
// ---------------------------------------------------------------------------

function UserRowMenu({ user, onRefresh, onView }: { user: AdminUser; onRefresh: () => void; onView: () => void }) {
  const [open, setOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function action(path: string, method = "POST") {
    setOpen(false);
    await fetch(path, { method });
    onRefresh();
  }

  async function changePlan(plan: string) {
    setOpen(false); setSubOpen(false);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_tier: plan }),
    });
    onRefresh();
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-[#6b8f88] hover:bg-[#1a3330] hover:text-white transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-48 rounded-xl border border-[#1a3330] bg-[#071A18] shadow-xl py-1">
          <MenuItem onClick={onView}>View Details</MenuItem>
          <div className="relative">
            <MenuItem onClick={() => setSubOpen((v) => !v)}>
              Change Plan <ChevronDown className="ml-auto h-3 w-3" />
            </MenuItem>
            {subOpen && (
              <div className="absolute right-0 top-full z-50 mt-0.5 w-44 rounded-xl border border-[#1a3330] bg-[#071A18] shadow-xl py-1">
                <MenuItem onClick={() => changePlan("popular")}>Upgrade to Popular</MenuItem>
                <MenuItem onClick={() => changePlan("pro")}>Upgrade to Pro</MenuItem>
                <MenuItem onClick={() => changePlan("free")}>Downgrade to Free</MenuItem>
              </div>
            )}
          </div>
          <MenuItem onClick={() => action(`/api/admin/users/${user.id}/reset-password`)}>Reset Password</MenuItem>
          <div className="my-1 border-t border-[#1a3330]" />
          {user.subscription_status === "suspended" ? (
            <MenuItem onClick={() => action(`/api/admin/users/${user.id}/unsuspend`)} className="text-green-400">Unsuspend</MenuItem>
          ) : (
            <MenuItem onClick={() => action(`/api/admin/users/${user.id}/suspend`)} className="text-red-400">Suspend User</MenuItem>
          )}
          <MenuItem onClick={async () => { setOpen(false); if (confirm("Delete this user permanently?")) await action(`/api/admin/users/${user.id}`, "DELETE"); }} className="text-red-400">
            Delete User
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick}
      className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#1a3330] transition-colors", className)}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------

function DashboardTab({ stats, onRefresh, signups, recentNotes, recentExams }: {
  stats: Stats;
  onRefresh: () => void;
  signups: ActivityItem[];
  recentNotes: ActivityItem[];
  recentExams: ActivityItem[];
}) {
  const total = stats.total_users || 1;
  return (
    <div className="space-y-6">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={stats.total_users} sub={`+${stats.new_users_today} today`} icon={Users} color="teal" />
        <StatCard label="Active Today" value={stats.active_users_today} sub={`+${stats.new_users_this_week} this week`} icon={Activity} color="green" />
        <StatCard label="Pro Users" value={stats.pro_users} sub={`${stats.popular_users} popular`} icon={Crown} color="orange" />
        <StatCard label="Est. Revenue" value={`₦${fmtNumber(stats.revenue_this_month)}`} sub="this month" icon={TrendingUp} color="blue" />
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Free", count: stats.free_users, color: "bg-slate-600" },
          { label: "Popular", count: stats.popular_users, color: "bg-teal-600" },
          { label: "Pro", count: stats.pro_users, color: "bg-orange-600" },
        ].map((p) => (
          <div key={p.label} className="rounded-xl border border-[#1a3330] bg-[#0D2B27] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("h-2.5 w-2.5 rounded-full", p.color)} />
              <p className="text-xs font-medium text-[#6b8f88] uppercase tracking-wide">{p.label}</p>
            </div>
            <p className="text-xl font-bold text-white">{fmtNumber(p.count)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-[#1a3330]">
              <div className={cn("h-1.5 rounded-full", p.color)} style={{ width: `${(p.count / total) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-[#6b8f88]">{Math.round((p.count / total) * 100)}% of users</p>
          </div>
        ))}
      </div>

      {/* Content stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Notes" value={stats.total_notes} icon={FileText} color="teal" />
        <StatCard label="Total Exams" value={stats.total_exams} icon={FileText} color="blue" />
        <StatCard label="Flashcards" value={stats.total_flashcards} icon={Zap} color="orange" />
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27]">
        <div className="flex items-center justify-between border-b border-[#1a3330] px-5 py-3">
          <p className="text-sm font-semibold text-white">Recent Signups</p>
          <button onClick={onRefresh} className="text-[#6b8f88] hover:text-teal-400 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-[#1a3330]">
          {signups.slice(0, 10).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar email={s.email ?? ""} plan={s.plan} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{s.email}</p>
                <p className="text-xs text-[#6b8f88]">{s.name || "—"}</p>
              </div>
              <PlanBadge plan={s.plan ?? "free"} />
              <p className="text-xs text-[#6b8f88] shrink-0">{relativeTime(s.created_at)}</p>
            </div>
          ))}
          {signups.length === 0 && <p className="px-5 py-4 text-sm text-[#6b8f88]">No signups yet.</p>}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27]">
        <div className="border-b border-[#1a3330] px-5 py-3">
          <p className="text-sm font-semibold text-white">Recent Activity</p>
        </div>
        <div className="divide-y divide-[#1a3330] max-h-64 overflow-y-auto">
          {[
            ...recentNotes.map((n) => ({ ...n, label: `📝 Note: "${n.title}"`, email: n.user_email })),
            ...recentExams.map((e) => ({ ...e, label: `🎯 Exam: "${e.title}"`, email: e.user_email })),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15).map((item) => (
            <div key={item.id + item.type} className="flex items-center justify-between px-5 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.label}</p>
                <p className="text-xs text-[#6b8f88]">{item.email}</p>
              </div>
              <p className="text-xs text-[#6b8f88] shrink-0 ml-3">{relativeTime(item.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

function UsersTab({ onViewUser }: { onViewUser: (id: string) => void }) {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [planFilter, setPlanFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (p = page, s = search, plan = planFilter, status = statusFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (s) params.set("search", s);
    if (plan) params.set("plan", plan);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/users?${params}`);
    const j   = await res.json();
    setUsers(j.data?.users ?? []);
    setTotal(j.data?.total ?? 0);
    setTotalPages(j.data?.total_pages ?? 1);
    setLoading(false);
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleSearch(v: string) {
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); fetchUsers(1, v, planFilter, statusFilter); }, 400);
  }

  async function bulkAction(action: string) {
    if (selected.size === 0) return;
    if (action === "delete" && !confirm(`Delete ${selected.size} users permanently?`)) return;
    setBulkBusy(true);
    await fetch("/api/admin/users/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userIds: [...selected] }),
    });
    setSelected(new Set());
    fetchUsers();
    setBulkBusy(false);
  }

  function exportCSV() {
    const header = "Email,Name,Plan,Status,Notes,Joined";
    const rows   = users
      .filter((u) => selected.size === 0 || selected.has(u.id))
      .map((u) => `${u.email},${u.full_name ?? ""},${u.subscription_tier},${u.subscription_status},${u.notes_count},${fmtDate(u.created_at)}`);
    const csv  = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "studyhub-users.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAll() {
    if (selected.size === users.length) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b8f88]" />
          <input
            value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="h-10 w-full rounded-lg border border-[#1a3330] bg-[#0D2B27] pl-9 pr-4 text-sm text-white placeholder:text-[#6b8f88] focus:outline-none focus:ring-1 focus:ring-teal-600"
          />
        </div>
        <Select value={planFilter} onChange={(v) => { setPlanFilter(v); setPage(1); fetchUsers(1, search, v, statusFilter); }}
          options={[{ value: "", label: "All Plans" }, { value: "free", label: "Free" }, { value: "popular", label: "Popular" }, { value: "pro", label: "Pro" }]} />
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); fetchUsers(1, search, planFilter, v); }}
          options={[{ value: "", label: "All Status" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "cancelled", label: "Cancelled" }]} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b8f88]">Showing {users.length} of {fmtNumber(total)} users</p>
        <button onClick={() => fetchUsers()} className="flex items-center gap-1.5 text-xs text-[#6b8f88] hover:text-teal-400 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </button>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border border-teal-700/40 bg-teal-900/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-teal-300">{selected.size} user{selected.size !== 1 ? "s" : ""} selected</p>
            <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-md border border-[#1a3330] px-2.5 py-1 text-xs text-white hover:bg-[#1a3330] transition-colors">
              <Download className="h-3.5 w-3.5" />Export CSV
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { action: "upgrade_popular", label: "Upgrade to Popular" },
              { action: "upgrade_pro",     label: "Upgrade to Pro" },
              { action: "downgrade_free",  label: "Downgrade to Free" },
              { action: "reset_password",  label: "Reset Password" },
              { action: "suspend",         label: "Suspend" },
              { action: "delete",          label: "Delete" },
            ].map(({ action, label }) => (
              <button key={action} onClick={() => bulkAction(action)} disabled={bulkBusy}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap",
                  action === "delete" || action === "suspend"
                    ? "border border-red-700/50 text-red-400 hover:bg-red-900/20"
                    : "border border-[#1a3330] text-white hover:bg-[#1a3330]"
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#1a3330] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a3330] bg-[#071A18]">
                  <th className="px-4 py-3 text-left"><input type="checkbox" checked={selected.size === users.length && users.length > 0} onChange={toggleAll} className="accent-teal-500" /></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide hidden sm:table-cell">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide hidden lg:table-cell">Notes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={cn("border-b border-[#1a3330] transition-colors hover:bg-[#0D2B27]/60", i % 2 === 0 ? "bg-[#0D2B27]" : "bg-[#071A18]")}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="accent-teal-500" /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => onViewUser(u.id)} className="flex items-center gap-2.5 text-left hover:text-teal-300 transition-colors">
                        <Avatar email={u.email} plan={u.subscription_tier} />
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate max-w-36">{u.email}</p>
                          <p className="text-xs text-[#6b8f88] truncate max-w-36">{u.full_name ?? "—"}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><PlanBadge plan={u.subscription_tier} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={u.subscription_status} /></td>
                    <td className="px-4 py-3 text-[#6b8f88] hidden lg:table-cell">{u.notes_count}</td>
                    <td className="px-4 py-3 text-[#6b8f88] hidden lg:table-cell">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <UserRowMenu user={u} onRefresh={() => fetchUsers()} onView={() => onViewUser(u.id)} />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[#6b8f88]">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchUsers(Math.max(1, page - 1)); }}
            disabled={page === 1} className="rounded-lg border border-[#1a3330] p-2 text-[#6b8f88] hover:text-white disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : i + Math.max(1, Math.min(page - 3, totalPages - 6));
            return (
              <button key={p} onClick={() => { setPage(p); fetchUsers(p); }}
                className={cn("h-8 w-8 rounded-lg text-sm transition-colors",
                  p === page ? "bg-teal-600 text-white" : "border border-[#1a3330] text-[#6b8f88] hover:text-white")}>
                {p}
              </button>
            );
          })}
          <button onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); fetchUsers(Math.min(totalPages, page + 1)); }}
            disabled={page === totalPages} className="rounded-lg border border-[#1a3330] p-2 text-[#6b8f88] hover:text-white disabled:opacity-30 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-lg border border-[#1a3330] bg-[#0D2B27] pl-3 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-600">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b8f88]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscriptions Tab
// ---------------------------------------------------------------------------

function SubscriptionsTab({ stats }: { stats: Stats }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState("popular");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?plan=${planFilter}&limit=100`)
      .then((r) => r.json())
      .then((j) => setUsers(j.data?.users ?? []))
      .finally(() => setLoading(false));
  }, [planFilter]);

  const popular = stats.popular_users * 5000;
  const pro     = stats.pro_users * 10000;

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27] p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6b8f88] mb-3">Revenue This Month</p>
        <p className="text-3xl font-bold text-white">₦{fmtNumber(popular + pro)}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#071A18] border border-[#1a3330] p-3">
            <p className="text-xs text-[#6b8f88]">Popular ({stats.popular_users} × ₦5,000)</p>
            <p className="text-lg font-semibold text-teal-400">₦{fmtNumber(popular)}</p>
          </div>
          <div className="rounded-lg bg-[#071A18] border border-[#1a3330] p-3">
            <p className="text-xs text-[#6b8f88]">Pro ({stats.pro_users} × ₦10,000)</p>
            <p className="text-lg font-semibold text-orange-400">₦{fmtNumber(pro)}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["popular", "pro"].map((p) => (
          <button key={p} onClick={() => setPlanFilter(p)}
            className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              planFilter === p ? "bg-teal-600 text-white" : "border border-[#1a3330] text-[#6b8f88] hover:text-white")}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a3330] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-teal-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a3330] bg-[#071A18]">
                  {["Email", "Plan", "Status", "Joined", "Expires", "Amount"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={cn("border-b border-[#1a3330]", i % 2 === 0 ? "bg-[#0D2B27]" : "bg-[#071A18]")}>
                    <td className="px-4 py-3 text-white">{u.email}</td>
                    <td className="px-4 py-3"><PlanBadge plan={u.subscription_tier} /></td>
                    <td className="px-4 py-3"><StatusBadge status={u.subscription_status} /></td>
                    <td className="px-4 py-3 text-[#6b8f88]">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-[#6b8f88]">{u.subscription_expires_at ? fmtDate(u.subscription_expires_at) : "—"}</td>
                    <td className="px-4 py-3 text-white font-medium">₦{fmtNumber(u.subscription_tier === "pro" ? 10000 : 5000)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[#6b8f88]">No {planFilter} subscribers.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Tab
// ---------------------------------------------------------------------------

function ActivityTab() {
  const [data, setData]     = useState<{ signups: ActivityItem[]; notes: ActivityItem[]; exams: ActivityItem[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/activity");
    const j   = await res.json();
    setData(j.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const feed = [
    ...(data?.signups ?? []).map((s) => ({ ...s, label: `🟢 New signup: ${s.email}` })),
    ...(data?.notes ?? []).map((n) => ({ ...n, label: `📝 Note created: "${n.title}" by ${n.user_email}` })),
    ...(data?.exams ?? []).map((e) => ({ ...e, label: `🎯 Exam uploaded by ${e.user_email}` })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b8f88]">Auto-refreshes every 30 seconds</p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-[#6b8f88] hover:text-teal-400 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />Refresh now
        </button>
      </div>
      <div className="rounded-xl border border-[#1a3330] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>
        ) : (
          <div className="divide-y divide-[#1a3330]">
            {feed.map((item, i) => (
              <div key={item.id + i} className={cn("flex items-center justify-between px-5 py-3", i % 2 === 0 ? "bg-[#0D2B27]" : "bg-[#071A18]")}>
                <p className="text-sm text-white">{item.label}</p>
                <p className="text-xs text-[#6b8f88] shrink-0 ml-4">{relativeTime(item.created_at)}</p>
              </div>
            ))}
            {feed.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#6b8f88]">No activity yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

function SettingsTab({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6b8f88] mb-4">Admin Account</p>
        <div className="flex items-center gap-4">
          <Avatar email={adminEmail} size={12} />
          <div>
            <p className="font-semibold text-white">{adminEmail}</p>
            <p className="text-sm text-teal-400 mt-0.5">Administrator</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#1a3330] bg-[#0D2B27] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6b8f88] mb-4">About</p>
        <p className="text-sm text-[#6b8f88]">StudyHub Admin Console v1.0</p>
        <p className="mt-1 text-sm text-[#6b8f88]">Manage users, subscriptions, and platform activity.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPage
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading]       = useState(true);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [activity, setActivity]     = useState<{ signups: ActivityItem[]; notes: ActivityItem[]; exams: ActivityItem[] } | null>(null);
  const [activeTab, setActiveTab]   = useState<NavTab>("dashboard");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [usersKey, setUsersKey]     = useState(0);

  useEffect(() => {
    async function init() {
      // Verify admin
      const checkRes = await fetch("/api/admin/check");
      const checkJson = await checkRes.json() as { data?: { isAdmin: boolean } };
      if (!checkJson.data?.isAdmin) { router.replace("/dashboard"); return; }

      // Get admin email
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json() as { data?: { user?: { email: string } } };
      setAdminEmail(meJson.data?.user?.email ?? "admin");

      // Load stats + activity in parallel
      const [statsRes, actRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/activity"),
      ]);
      const sj = await statsRes.json();
      const aj = await actRes.json();
      setStats(sj.data ?? null);
      setActivity(aj.data ?? null);
      setLoading(false);
    }
    void init();
  }, [router]);

  async function refreshStats() {
    const res = await fetch("/api/admin/stats");
    const j   = await res.json();
    setStats(j.data ?? null);
  }

  const NAV: { key: NavTab; label: string; icon: React.ElementType }[] = [
    { key: "dashboard",     label: "Dashboard",     icon: LayoutDashboard },
    { key: "users",         label: "Users",         icon: Users },
    { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
    { key: "activity",      label: "Activity",      icon: Activity },
    { key: "settings",      label: "Settings",      icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#050F0D" }}>
        <Loader2 className="h-7 w-7 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#050F0D" }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-[#1a3330] transition-transform duration-200 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )} style={{ background: "#071A18" }}>
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-[#1a3330] px-5 py-5">
          <div>
            <p className="text-base font-bold text-white">⚙️ Admin Console</p>
            <p className="text-xs text-teal-500 mt-0.5">StudyHub AI</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-[#6b8f88] hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === key ? "bg-teal-600/20 text-teal-300" : "text-[#6b8f88] hover:bg-[#1a3330] hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1a3330] p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#6b8f88] hover:bg-[#1a3330] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />Back to App
          </Link>
          <p className="px-3 text-xs text-[#6b8f88] truncate">{adminEmail}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#1a3330] px-6 py-4" style={{ background: "#071A18" }}>
          <button onClick={() => setSidebarOpen(true)} className="text-[#6b8f88] hover:text-white transition-colors lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-white capitalize">
            {NAV.find((n) => n.key === activeTab)?.label ?? "Admin"}
          </h1>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "dashboard" && stats && (
            <DashboardTab
              stats={stats}
              onRefresh={refreshStats}
              signups={activity?.signups ?? []}
              recentNotes={activity?.notes ?? []}
              recentExams={activity?.exams ?? []}
            />
          )}
          {activeTab === "users" && (
            <UsersTab key={usersKey} onViewUser={setDetailUserId} />
          )}
          {activeTab === "subscriptions" && stats && (
            <SubscriptionsTab stats={stats} />
          )}
          {activeTab === "activity" && <ActivityTab />}
          {activeTab === "settings" && <SettingsTab adminEmail={adminEmail} />}
        </main>
      </div>

      {/* User detail slide-over */}
      {detailUserId && (
        <UserDetailSlideOver
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onUpdated={() => setUsersKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
