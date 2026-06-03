"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { OnboardingModal } from "@/components/onboarding-modal";
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  BookOpen, Loader2, Layers,
  Users, ExternalLink, UserPlus, GraduationCap,
  Upload, CheckCircle2, CheckCircle, XCircle, Eye, ChevronRight, HelpCircle, Zap,
  Folder, FolderOpen, Brain, Target, Star, FolderInput,
  Pencil, Check, X as XIcon, Bell,
  Calendar, Clock, RotateCcw, History, ThumbsDown, ThumbsUp,
  Bot, Home, Paperclip, Sparkles, Send,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AvatarDropdown } from "@/components/avatar-dropdown";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Note {
  id: string;
  title: string;
  content: string;
  ai_summary: string | null;
  created_at: string;
  folder_id: string | null;
}

interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  note_count: number;
  created_at: string;
}

const FOLDER_COLORS = ["#14B8A7","#F97316","#8B5CF6","#EF4444","#10B981","#3B82F6","#F59E0B","#EC4899"];
const FOLDER_ICONS  = ["folder","book-open","brain","target","users","star"] as const;
type FolderIconKey = typeof FOLDER_ICONS[number];

const FOLDER_ICON_MAP: Record<FolderIconKey, React.ElementType> = {
  "folder":    Folder,
  "book-open": BookOpen,
  "brain":     Brain,
  "target":    Target,
  "users":     Users,
  "star":      Star,
};

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

interface Prediction {
  question: string;
  topic: string;
  likelihood: "high" | "medium" | "low";
  explanation: string;
}

interface Exam {
  id: string;
  title: string;
  status: "pending" | "ready" | "failed";
  predictions: Prediction[] | null;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  role: string;
  invite_code?: string | null;
}

interface StudyPlan {
  id: string;
  title: string;
  subject: string;
  exam_date: string;
  status: "generating" | "ready" | "failed";
  note_ids: string[];
  created_at: string;
  progress: { total: number; completed: number };
}

interface StudyPlanDay {
  id: string;
  plan_id: string;
  study_date: string;
  day_number: number;
  title: string;
  description: string;
  note_ids: string[];
  is_completed: boolean;
  is_today: boolean;
  is_past: boolean;
}

interface WeakArea {
  flashcard_id: string;
  note_id: string;
  question: string;
  answer: string;
  note_title: string;
  incorrect_count: number;
  correct_count: number;
  accuracy_pct: number;
}

interface DueCard {
  flashcard_id: string;
  note_id: string;
  question: string;
  answer: string;
  note_title: string;
}

interface NoteVersion {
  id: string;
  version_number: number;
  title: string;
  created_at: string;
  content_preview: string | null;
}

interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AiMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: string[];
  created_at: string;
}

interface User {
  id: string;
  email: string;
  avatarUrl?: string | null;
}

interface UsageStat { used: number; limit: number }

interface StudentProfile {
  userId: string;
  fullName: string | null;
  totalNotes: number;
  recentTopics: string[];
  upcomingExams: { subject: string; examDate: string }[];
  weakAreas: { topic: string; accuracy: number }[];
  currentStreak: number;
  totalStudyDays: number;
  flashcardsReviewed: number;
  avgAccuracy: number | null;
  preferredSubjects: string[];
  profileCompleteness: number;
  builtAt: string;
}

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
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({ label, direction = "above", children }: {
  label: string;
  direction?: "above" | "below" | "right";
  children: React.ReactNode;
}) {
  const pos = {
    above: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    below: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };
  return (
    <div className="group/tooltip relative inline-flex">
      {children}
      <span className={cn(
        "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-sm",
        "opacity-0 transition-opacity delay-300 group-hover/tooltip:opacity-100",
        pos[direction],
      )}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderIcon helper
// ---------------------------------------------------------------------------

function FolderIconEl({ icon, className }: { icon: string; className?: string }) {
  const Icon = FOLDER_ICON_MAP[icon as FolderIconKey] ?? Folder;
  return <Icon className={className} />;
}

// ---------------------------------------------------------------------------
// CreateFolderDialog
// ---------------------------------------------------------------------------

function CreateFolderDialog({ onCreated }: { onCreated: (folder: Folder) => void }) {
  const [open, setOpen]               = useState(false);
  const [name, setName]               = useState("");
  const [color, setColor]             = useState(FOLDER_COLORS[0]);
  const [icon, setIcon]               = useState<FolderIconKey>("folder");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, icon }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to create folder"); return; }
      onCreated({ ...json.data.folder, note_count: 0 });
      setName(""); setOpen(false);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />New folder
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="e.g. Biology" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="relative h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                  aria-label={c}
                >
                  {color === c && <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2">
              {FOLDER_ICONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIcon(k)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                    icon === k ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground",
                  )}
                  aria-label={k}
                >
                  <FolderIconEl icon={k} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create folder"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RenameFolderDialog
// ---------------------------------------------------------------------------

function RenameFolderDialog({
  folder, onRenamed, children,
}: {
  folder: Folder;
  onRenamed: (folder: Folder) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen]       = useState(false);
  const [name, setName]       = useState(folder.name);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to rename"); return; }
      onRenamed({ ...folder, name });
      setOpen(false);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(folder.name); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rename folder</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// FolderSidebar (desktop)
// ---------------------------------------------------------------------------

function FolderSidebar({
  folders, selectedFolderId, uncategorizedCount, allCount,
  onSelect, onFolderCreated, onFolderRenamed, onFolderDeleted,
}: {
  folders: Folder[];
  selectedFolderId: string | null;
  uncategorizedCount: number;
  allCount: number;
  onSelect: (id: string | null) => void;
  onFolderCreated: (f: Folder) => void;
  onFolderRenamed: (f: Folder) => void;
  onFolderDeleted: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteFolder(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
      if (res.ok) { onFolderDeleted(id); if (selectedFolderId === id) onSelect(null); }
    } finally { setDeletingId(null); }
  }

  const items: { id: string | null; label: string; count: number; color?: string; icon?: string }[] = [
    { id: null, label: "All Notes", count: allCount },
    ...folders.map((f) => ({ id: f.id, label: f.name, count: f.note_count, color: f.color, icon: f.icon })),
    { id: "uncategorized", label: "Uncategorized", count: uncategorizedCount },
  ];

  return (
    <aside className="hidden w-52 shrink-0 sm:block">
      <div className="space-y-0.5">
        {items.map(({ id, label, count, color, icon }) => {
          const isSelected = selectedFolderId === id;
          const isFolder = id !== null && id !== "uncategorized";
          return (
            <div key={id ?? "all"} className="group/item flex items-center gap-1">
              <button
                onClick={() => onSelect(id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isSelected ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="shrink-0" style={color ? { color } : undefined}>
                  {icon ? (
                    <FolderIconEl icon={icon} className="h-3.5 w-3.5" />
                  ) : id === "uncategorized" ? (
                    <Folder className="h-3.5 w-3.5" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 text-xs opacity-60">{count}</span>
              </button>
              {isFolder && (
                <div className="hidden shrink-0 items-center gap-0.5 group-hover/item:flex">
                  <RenameFolderDialog
                    folder={folders.find((f) => f.id === id)!}
                    onRenamed={onFolderRenamed}
                  >
                    <button className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Rename">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </RenameFolderDialog>
                  <ConfirmDialog
                    open={deletingId === id}
                    title="Delete folder?"
                    description={`"${label}" will be deleted. Notes inside will become uncategorized.`}
                    confirmLabel="Delete"
                    onConfirm={() => handleDeleteFolder(id!)}
                    onCancel={() => setDeletingId(null)}
                    loading={false}
                  />
                  <button
                    onClick={() => setDeletingId(id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Delete folder"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <CreateFolderDialog onCreated={onFolderCreated} />
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// FolderChips (mobile)
// ---------------------------------------------------------------------------

function FolderChips({
  folders, selectedFolderId, uncategorizedCount,
  onSelect,
}: {
  folders: Folder[];
  selectedFolderId: string | null;
  uncategorizedCount: number;
  onSelect: (id: string | null) => void;
}) {
  const items: { id: string | null; label: string; color?: string }[] = [
    { id: null, label: "All" },
    ...folders.map((f) => ({ id: f.id, label: f.name, color: f.color })),
    { id: "uncategorized", label: "Uncategorized" },
  ];

  return (
    <div className="hide-scrollbar -mx-6 mb-4 flex gap-2 overflow-x-auto px-6 sm:hidden">
      {items.map(({ id, label, color }) => (
        <button
          key={id ?? "all"}
          onClick={() => onSelect(id)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            selectedFolderId === id
              ? "border-transparent text-white"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
          style={selectedFolderId === id ? { backgroundColor: color ?? "var(--accent)" } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MoveFolderModal
// ---------------------------------------------------------------------------

function MoveFolderModal({
  note, folders, onMove, onClose,
}: {
  note: Note | null;
  folders: Folder[];
  onMove: (noteId: string, folderId: string | null) => void;
  onClose: () => void;
}) {
  if (!note) return null;

  const options: { id: string | null; label: string; color?: string; icon?: string }[] = [
    { id: null, label: "Uncategorized" },
    ...folders.map((f) => ({ id: f.id, label: f.name, color: f.color, icon: f.icon })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-sm">Move to folder</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {options.map(({ id, label, color, icon }) => {
            const isCurrent = note.folder_id === id;
            return (
              <button
                key={id ?? "none"}
                onClick={() => { onMove(note.id, id); onClose(); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center" style={color ? { color } : undefined}>
                  {icon ? <FolderIconEl icon={icon} className="h-4 w-4" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                </span>
                <span className="flex-1 text-left">{label}</span>
                {isCurrent && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreakWidget
// ---------------------------------------------------------------------------

interface StreakData {
  current_streak: number;
  longest_streak: number;
  total_study_days: number;
  last_study_date: string | null;
  studied_today: boolean;
  activity: { date: string; count: number }[];
}

function StreakWidget({ streak }: { streak: StreakData }) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const atRisk =
    streak.current_streak > 0 &&
    !streak.studied_today &&
    streak.last_study_date === yesterday;

  const fireEmoji = (() => {
    if (streak.current_streak === 0) return "❄️";
    if (streak.current_streak >= 30) return "🏆";
    if (streak.current_streak >= 7)  return "🔥🔥";
    return "🔥";
  })();

  const isPulsing = streak.current_streak >= 7 && streak.current_streak < 30;

  const last14 = (streak.activity ?? []).slice(-14);

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left — current streak */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={cn("text-2xl leading-none sm:text-3xl", isPulsing && "animate-pulse")}>
            {fireEmoji}
          </span>
          <div>
            <p className="text-xl font-bold leading-none text-orange-400 sm:text-2xl">
              {streak.current_streak}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">day streak</p>
          </div>
          {streak.studied_today && (
            <span className="hidden items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400 sm:flex">
              <Check className="h-3 w-3" />Today
            </span>
          )}
        </div>

        {/* Center — 14-day heatmap (desktop only) */}
        <div className="hidden flex-1 items-center justify-center gap-1 sm:flex">
          {last14.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} activities`}
              className={cn(
                "h-4 w-4 rounded-sm",
                day.count === 0 ? "bg-border" :
                day.count <= 2  ? "bg-accent/40" :
                day.count <= 5  ? "bg-accent/70" :
                "bg-accent",
              )}
            />
          ))}
        </div>

        {/* Right — stats */}
        <div className="flex gap-3 text-center sm:gap-4">
          <div>
            <p className="text-sm font-bold leading-none">{streak.longest_streak}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Best</p>
          </div>
          <div>
            <p className="text-sm font-bold leading-none">{streak.total_study_days}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {/* Streak-at-risk warning */}
      {atRisk && (
        <p className="mt-2 text-xs font-medium text-orange-400">
          ⚠️ Study today to keep your streak!
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileCard
// ---------------------------------------------------------------------------

function ProfileCard({ profile, onRebuild }: { profile: StudentProfile; onRebuild: () => void }) {
  const [rebuilding, setRebuilding] = useState(false);

  async function handleRebuild() {
    setRebuilding(true);
    try {
      await fetch("/api/profile", { method: "POST" });
      onRebuild();
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent shrink-0" />
          <p className="text-sm font-semibold">Your Study Profile</p>
        </div>
        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          title="Refresh profile"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className={cn("h-3.5 w-3.5", rebuilding && "animate-spin")} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-background/60 px-3 py-2 text-center">
          <p className="text-lg font-bold leading-none">{profile.totalNotes}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Notes</p>
        </div>
        <div className="rounded-lg bg-background/60 px-3 py-2 text-center">
          <p className="text-lg font-bold leading-none">{profile.flashcardsReviewed}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Cards reviewed</p>
        </div>
        <div className="rounded-lg bg-background/60 px-3 py-2 text-center">
          <p className="text-lg font-bold leading-none">{profile.avgAccuracy !== null ? `${profile.avgAccuracy}%` : "—"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Accuracy</p>
        </div>
        <div className="rounded-lg bg-background/60 px-3 py-2 text-center">
          <p className="text-lg font-bold leading-none">{profile.upcomingExams.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Exams ahead</p>
        </div>
      </div>

      {profile.upcomingExams.length > 0 && (
        <div className="mt-3 space-y-1">
          {profile.upcomingExams.slice(0, 2).map((exam) => {
            const daysUntil = Math.ceil((new Date(exam.examDate).getTime() - Date.now()) / 86_400_000);
            const urgency = daysUntil <= 3 ? "text-red-400" : daysUntil <= 7 ? "text-orange-400" : "text-muted-foreground";
            return (
              <div key={exam.examDate + exam.subject} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-1.5">
                <p className="text-xs font-medium truncate">{exam.subject}</p>
                <p className={cn("text-xs shrink-0 ml-2", urgency)}>
                  {daysUntil <= 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {profile.recentTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.recentTopics.slice(0, 4).map((topic) => (
            <span key={topic} className="rounded-full bg-background/60 px-2 py-0.5 text-xs text-muted-foreground truncate max-w-[120px]">
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UpgradeModal
// ---------------------------------------------------------------------------

function UpgradeModal({ open, message, onClose }: { open: boolean; message: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-1 text-3xl text-center">⚡</div>
        <h2 className="mt-2 text-center text-lg font-bold">You've reached your limit</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">{message}</p>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1 bg-orange-500 text-white hover:bg-orange-600 gap-1.5" asChild>
            <Link href="/pricing"><Zap className="h-3.5 w-3.5" />View Plans</Link>
          </Button>
          <Button variant="outline" onClick={onClose}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, flashcardCount, folder, folders, onDelete, onStudy, onMove, onHistory, onEdit, onGenerateMore }: {
  note: Note;
  flashcardCount: number | undefined;
  folder?: Folder;
  folders: Folder[];
  onDelete: (id: string) => void;
  onStudy: (noteId: string, noteTitle: string) => void;
  onMove: (note: Note) => void;
  onHistory: (note: Note) => void;
  onEdit: (note: Note) => void;
  onGenerateMore?: (noteId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (res.ok) { setConfirmOpen(false); onDelete(note.id); }
    } finally { setDeleting(false); }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this note?"
        description={`This will permanently delete "${note.title}" and all its flashcards. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
    <div className="group rounded-xl border border-border/60 border-l-4 border-l-accent bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{note.title}</h3>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
            {folder && (
              <span
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${folder.color}20`, color: folder.color }}
              >
                <FolderIconEl icon={folder.icon} className="h-2.5 w-2.5" />
                {folder.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label="Edit note">
            <button
              onClick={() => onEdit(note)}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit note"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Version history">
            <button
              onClick={() => onHistory(note)}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Version history"
            >
              <History className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label="Move to folder">
            <button
              onClick={() => onMove(note)}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Move to folder"
            >
              <FolderInput className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label={expanded ? "Collapse" : "Expand"}>
            <button onClick={() => setExpanded((v) => !v)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </Tooltip>
          <Tooltip label="Delete note">
            <button onClick={() => setConfirmOpen(true)} className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive" aria-label="Delete note" title="Delete note">
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
      {note.ai_summary ? (
        <>
          <div className="mt-3">
            <Tooltip label="Automatically generated when you save a note">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                <Sparkles className="h-3 w-3" />
                Auto AI Summary
              </span>
            </Tooltip>
          </div>
          <p className="mt-1.5 rounded-md bg-orange-500/10 px-3 py-2 text-sm text-orange-400">{note.ai_summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onStudy(note.id, note.title)}>
              <Layers className="h-3.5 w-3.5" />
              Flashcards
              {flashcardCount !== undefined && flashcardCount > 0 && (
                <span className="ml-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400">
                  {flashcardCount}
                </span>
              )}
            </Button>
            {flashcardCount !== undefined && flashcardCount > 0 && onGenerateMore && (
              <button
                onClick={() => onGenerateMore(note.id)}
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <Plus className="h-3 w-3" />Generate more
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />Generating summary…
        </p>
      )}
      {expanded && (
        <div className="mt-3 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed space-y-2">
          {(note.content ?? "").split(/\n{2,}/).map((para, i) => (
            para.trim() ? (
              <ReactMarkdown key={i} className="[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:mb-0.5 [&>h1]:text-base [&>h1]:font-semibold [&>h2]:text-sm [&>h2]:font-semibold [&>h3]:text-sm [&>h3]:font-medium [&>strong]:text-foreground [&>blockquote]:border-l-2 [&>blockquote]:border-accent [&>blockquote]:pl-3 [&>blockquote]:italic">
                {para.trim()}
              </ReactMarkdown>
            ) : null
          ))}
        </div>
      )}
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// NewNoteDialog
// ---------------------------------------------------------------------------

function NewNoteDialog({ onCreated, open, onOpenChange, onLimitReached, folders, initialFolderId }: {
  onCreated: (note: Note) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLimitReached?: (message: string) => void;
  folders?: Folder[];
  initialFolderId?: string | null;
}) {
  const [title, setTitle]         = useState("");
  const [content, setContent]     = useState("");
  const [folderId, setFolderId]   = useState<string | null>(initialFolderId ?? null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Sync folderId when initialFolderId changes (e.g. user selects folder then opens dialog)
  useEffect(() => { setFolderId(initialFolderId ?? null); }, [initialFolderId, open]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/notes/extract-file", { method: "POST", body: formData });
      const j = await res.json() as { data?: { content: string }; error?: string };
      if (res.ok && j.data?.content) {
        setContent((prev) => prev ? `${prev}\n\n${j.data!.content}` : j.data!.content);
        setUploadedFileName(file.name);
      } else {
        setError(j.error ?? "Failed to extract file content");
      }
    } catch { setError("Network error extracting file"); }
    finally {
      setExtracting(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = { title, content };
      if (folderId) body.folder_id = folderId;
      const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (res.status === 403) { onOpenChange(false); onLimitReached?.(json.error ?? "Note limit reached."); return; }
      if (!res.ok) { setError(json.error ?? "Failed to create note"); return; }
      onCreated(json.data?.note ?? json.data);
      setTitle(""); setContent(""); onOpenChange(false);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const hasFolders = folders && folders.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-w-[44px]">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New note</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New study note</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" placeholder="e.g. Chapter 3 — Cellular Respiration" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note-content">Content</Label>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-accent hover:underline">
                  <Paperclip className="h-3.5 w-3.5" />
                  Upload document
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt,.pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    disabled={extracting}
                  />
                </label>
                <span className="text-xs text-muted-foreground">· Max 10 MB · .pdf .txt .png .jpg</span>
              </div>
            </div>
            {extracting && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Extracting text from document…
              </p>
            )}
            {uploadedFileName && !extracting && (
              <p className="flex items-center gap-1.5 text-xs text-green-400">
                <Check className="h-3 w-3" />
                Extracted: {uploadedFileName}
              </p>
            )}
            <Textarea id="note-content" placeholder="Write your study notes here…" value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>
          {hasFolders && (
            <div className="space-y-2">
              <Label>Folder (optional)</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFolderId(null)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    folderId === null ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-muted-foreground",
                  )}
                >
                  None
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFolderId(f.id)}
                    className={cn("flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors")}
                    style={folderId === f.id
                      ? { backgroundColor: `${f.color}20`, borderColor: f.color, color: f.color }
                      : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                    }
                  >
                    <FolderIconEl icon={f.icon} className="h-2.5 w-2.5" />
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save note"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CreateGroupDialog
// ---------------------------------------------------------------------------

function CreateGroupDialog({ onCreated, onLimitReached }: {
  onCreated: (group: Group) => void;
  onLimitReached?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const json = await res.json();
      if (res.status === 403) { setOpen(false); onLimitReached?.(json.error ?? "Upgrade to create study groups."); return; }
      if (!res.ok) { setError(json.error ?? "Failed to create group"); return; }
      onCreated({ ...json.data.group, member_count: 1, role: "owner" });
      setName(""); setOpen(false);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="min-w-[44px]">
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Create group</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New study group</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input id="group-name" placeholder="e.g. Biology Study Squad" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create group"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// GroupCard
// ---------------------------------------------------------------------------

function GroupCard({ group }: { group: Group }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{group.name}</h3>
            {group.role === "owner" && (
              <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">owner</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {group.member_count} member{group.member_count === 1 ? "" : "s"} · Created {formatDate(group.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {group.invite_code && (
            <button
              onClick={() => {
                const link = `${window.location.origin}/join/${group.invite_code}`;
                const msg = encodeURIComponent(`Join my study group "${group.name}" on StudyHub AI! 📚\n\nClick to join: ${link}`);
                window.open(`https://wa.me/?text=${msg}`, "_blank");
              }}
              title="Share via WhatsApp"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-500/15 text-green-500 hover:bg-green-500/25 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.535 5.875L.057 23.476a.75.75 0 0 0 .92.92l5.733-1.466A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.188-1.453l-.36-.215-3.795.97.999-3.687-.236-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            </button>
          )}
          <Button size="sm" variant="outline" className="shrink-0 min-w-[72px]" asChild>
            <Link href={`/dashboard/groups/${group.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />View
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictionCard
// ---------------------------------------------------------------------------

function PredictionCard({ prediction, onAskAI }: { prediction: Prediction; onAskAI?: (q: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const likelihoodStyles = {
    high:   "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low:    "bg-red-500/20 text-red-400",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-medium leading-relaxed text-sm [&>p]:mb-1 [&>p:last-child]:mb-0"><ReactMarkdown>{prediction.question}</ReactMarkdown></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {prediction.topic}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", likelihoodStyles[prediction.likelihood])}>
          {prediction.likelihood} likelihood
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
          Why this question?
        </button>
        {onAskAI && (
          <button
            onClick={() => onAskAI(prediction.question)}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Bot className="h-3 w-3" />
            Ask AI for answer
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed [&>p]:mb-1 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>li]:mb-0.5">
          <ReactMarkdown>{prediction.explanation}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictionsModal
// ---------------------------------------------------------------------------

function PredictionsModal({ exam, onAskAI }: { exam: Exam; onAskAI?: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const predictions = exam.predictions ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          title="View Predictions"
          className="flex items-center justify-center h-7 w-7 rounded-full bg-accent/15 text-accent hover:bg-accent/30 transition-colors"
        >
          <Eye className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{exam.title} — Predicted Questions</DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-xs text-muted-foreground">
          {predictions.length} predicted question{predictions.length !== 1 ? "s" : ""}. Click "Why this question?" to see the reasoning.
        </p>
        <div className="mt-4 space-y-3">
          {predictions.map((p, i) => (
            <PredictionCard key={i} prediction={p} onAskAI={onAskAI} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ExamCard
// ---------------------------------------------------------------------------

function ExamCard({ exam, onDelete, onAskAI }: { exam: Exam; onDelete: (id: string) => void; onAskAI?: (q: string) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" });
      if (res.ok) { setConfirmOpen(false); onDelete(exam.id); }
    } finally { setDeleting(false); }
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this exam?"
        description={`This will permanently delete "${exam.title}" and all its predictions. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
        loading={deleting}
      />
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug break-words">{exam.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(exam.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {exam.status === "ready" && (
              <div title="Ready" className="flex items-center justify-center h-7 w-7 rounded-full bg-green-500/15">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            )}
            {exam.status === "pending" && (
              <div title="Generating..." className="flex items-center justify-center h-7 w-7 rounded-full bg-accent/15">
                <Loader2 className="h-4 w-4 text-accent animate-spin" />
              </div>
            )}
            {exam.status === "failed" && (
              <div title="Failed" className="flex items-center justify-center h-7 w-7 rounded-full bg-destructive/15">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
            )}
            {exam.status === "ready" && <PredictionsModal exam={exam} onAskAI={onAskAI} />}
            <button
              onClick={() => setConfirmOpen(true)}
              title="Delete"
              className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Delete exam"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

function DashboardPage({ initialTab }: { initialTab: "notes" | "groups" | "exams" | "planner" | "ai" }) {
  const router       = useRouter();
  const [user, setUser]           = useState<User | null>(null);

  // Listen for avatar updates from account page (same tab via storage event)
  useEffect(() => {
    function handleAvatarUpdate(e: StorageEvent) {
      if (e.key === "avatar_url" && e.newValue) {
        setUser(prev => prev ? { ...prev, avatarUrl: e.newValue } : prev);
      }
    }
    // BroadcastChannel for same-tab updates
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("studyhub_avatar");
      bc.onmessage = (e: MessageEvent<{ avatar_url: string | null }>) => {
        if (e.data && "avatar_url" in e.data) {
          setUser(prev => prev ? { ...prev, avatarUrl: e.data.avatar_url } : prev);
        }
      };
    } catch { /* BroadcastChannel not supported */ }
    window.addEventListener("storage", handleAvatarUpdate);
    return () => {
      window.removeEventListener("storage", handleAvatarUpdate);
      bc?.close();
    };
  }, []);
  const [notes, setNotes]         = useState<Note[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode]         = useState(false);
  const [noteSearch, setNoteSearch]     = useState("");
  const [exams, setExams]         = useState<Exam[]>([]);
  const [folders, setFolders]     = useState<Folder[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [selectedFolderId, setSelectedFolderId]     = useState<string | null>(null);
  const [moveNoteTarget, setMoveNoteTarget]         = useState<Note | null>(null);
  const [tab, setTab]             = useState<"notes" | "groups" | "exams" | "planner" | "ai">(initialTab);
  const [newNoteOpen, setNewNoteOpen]             = useState(false);
  const [onboardingOpen, setOnboardingOpen]       = useState(false);
  const [subscription, setSubscription]           = useState<Subscription | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen]   = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");
  const [cancelSubOpen, setCancelSubOpen]         = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);
  const [isAdmin, setIsAdmin]             = useState(false);

  // Study mode state
  const [studyMode, setStudyMode]               = useState(false);
  const [studyFlashcards, setStudyFlashcards]   = useState<Flashcard[]>([]);
  const [studyNoteTitle, setStudyNoteTitle]     = useState("");
  const [studyNoteId, setStudyNoteId]           = useState<string | null>(null);
  const [studyLoading, setStudyLoading]         = useState(false);
  const [currentCard, setCurrentCard]           = useState(0);
  const [flipped, setFlipped]                   = useState(false);
  const reviewedCardsRef = useRef<Set<number>>(new Set());
  const [sessionCorrect, setSessionCorrect]     = useState(0);
  const [sessionIncorrect, setSessionIncorrect] = useState(0);
  const [sessionDone, setSessionDone]           = useState(false);
  const answeredCardsRef = useRef<Set<number>>(new Set());

  // Planner state
  const [plans, setPlans]                   = useState<StudyPlan[]>([]);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan]     = useState<StudyPlan | null>(null);
  const [planDays, setPlanDays]             = useState<StudyPlanDay[]>([]);
  const [planLoading, setPlanLoading]       = useState(false);
  const planPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Weak areas + spaced repetition
  const [weakAreas, setWeakAreas]   = useState<WeakArea[]>([]);
  const [dueCards, setDueCards]     = useState<DueCard[]>([]);

  // Version history
  const [versionHistoryNote, setVersionHistoryNote] = useState<Note | null>(null);
  const [versions, setVersions]                     = useState<NoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading]       = useState(false);
  const [versionPreview, setVersionPreview]         = useState<{ version_number: number; title: string; content: string | null } | null>(null);
  const [restoringVersion, setRestoringVersion]     = useState<number | null>(null);

  // AI Assistant state
  const [aiConversations, setAiConversations]     = useState<AiConversation[]>([]);
  const [prefilledQuestion, setPrefilledQuestion] = useState<string | null>(null);
  const [generatingMore, setGeneratingMore]       = useState(false);

  // Edit note state
  const [editNote, setEditNote]               = useState<Note | null>(null);
  const [editTitle, setEditTitle]             = useState("");
  const [editContent, setEditContent]         = useState("");
  const [editFolderId, setEditFolderId]       = useState<string | null>(null);
  const [saving, setSaving]                   = useState(false);
  const [editExtracting, setEditExtracting]   = useState(false);

  // Streak state
  const [streak, setStreak]             = useState<StreakData | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  // Student profile
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);

  // Notifications state
  interface Notification {
    id: string;
    type: string;
    message: string;
    is_read: boolean;
    group_id: string | null;
    note_id: string | null;
    created_at: string;
    action_url: string;
    from_user: { full_name: string | null } | null;
  }
  const [notifications, setNotifications]     = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [notifOpen, setNotifOpen]             = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Exam upload form state
  const [examTitle, setExamTitle]         = useState("");
  const [examFile, setExamFile]           = useState<File | null>(null);
  const [examImagePreview, setExamImagePreview] = useState<string | null>(null);
  const [examError, setExamError]         = useState("");
  const [examUploading, setExamUploading] = useState(false);

  function handleExamFileChange(file: File | null) {
    if (examImagePreview) URL.revokeObjectURL(examImagePreview);
    if (!file) { setExamFile(null); setExamImagePreview(null); return; }
    if (file.size > 10 * 1024 * 1024) {
      setExamError("File exceeds the 10 MB limit");
      setExamFile(null); setExamImagePreview(null); return;
    }
    setExamError("");
    setExamFile(file);
    setExamImagePreview(/\.(png|jpe?g)$/i.test(file.name) ? URL.createObjectURL(file) : null);
  }
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [flashcardsMap, setFlashcardsMap]         = useState<Record<string, Flashcard[]>>({});
  const [fetchingFlashcards, setFetchingFlashcards] = useState<Set<string>>(new Set());

  // Tracks active polling intervals so they can be cleared on delete or unmount
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    return () => { pollIntervalsRef.current.forEach((id) => clearInterval(id)); };
  }, []);

  async function loadFlashcards(noteId: string) {
    if (flashcardsMap[noteId] !== undefined || fetchingFlashcards.has(noteId)) return;
    setFetchingFlashcards((prev) => new Set(prev).add(noteId));
    try {
      const res = await fetch(`/api/notes/${noteId}/flashcards`);
      if (!res.ok) return;
      const json = await res.json() as { data?: { flashcards: Flashcard[] } };
      setFlashcardsMap((prev) => ({ ...prev, [noteId]: Array.isArray(json.data?.flashcards) ? json.data.flashcards : [] }));
    } finally {
      setFetchingFlashcards((prev) => { const next = new Set(prev); next.delete(noteId); return next; });
    }
  }

  function startFlashcardsPolling(noteId: string) {
    // Don't start a duplicate if one is already running for this note
    if (pollIntervalsRef.current.has(`fc_${noteId}`)) return;
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > 60000) {
        clearInterval(interval);
        pollIntervalsRef.current.delete(`fc_${noteId}`);
        return;
      }
      try {
        const res = await fetch(`/api/notes/${noteId}/flashcards`);
        if (!res.ok) return;
        const json = await res.json() as { data?: { flashcards: Flashcard[] } };
        const cards = json.data?.flashcards;
        if (Array.isArray(cards) && cards.length > 0) {
          setFlashcardsMap((prev) => ({ ...prev, [noteId]: cards }));
          clearInterval(interval);
          pollIntervalsRef.current.delete(`fc_${noteId}`);
        }
      } catch { /* ignore */ }
    }, 3000);
    pollIntervalsRef.current.set(`fc_${noteId}`, interval);
  }

  function startSummaryPolling(noteId: string) {
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > 60000) {
        clearInterval(interval);
        pollIntervalsRef.current.delete(noteId);
        return;
      }
      try {
        const res = await fetch(`/api/notes/${noteId}?nocache=1`);
        if (!res.ok) return;
        const json = await res.json() as { data?: { note: Note } };
        const updated = json.data?.note;
        if (updated?.ai_summary) {
          setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, ...updated } : n));
          clearInterval(interval);
          pollIntervalsRef.current.delete(noteId);
          startFlashcardsPolling(noteId);
        }
      } catch { /* ignore */ }
    }, 3000);
    pollIntervalsRef.current.set(noteId, interval);
  }

  function startExamPolling(examId: string) {
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > 120000) { clearInterval(interval); return; }
      try {
        const res = await fetch(`/api/exams/${examId}?nocache=1`);
        if (!res.ok) return;
        const json = await res.json() as { data?: { exam: Exam } };
        const updated = json.data?.exam;
        if (updated && (updated.status === "ready" || updated.status === "failed")) {
          setExams((prev) => prev.map((e) => e.id === examId ? updated : e));
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  // Load initial data — runs once on mount
  useEffect(() => {
    async function init() {
      try {
        // Tier 1 — critical: auth + main content (loads immediately)
        const [meRes, notesRes, groupsRes, examsRes, subRes, foldersRes, streaksRes, notifsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/notes"),
          fetch("/api/groups"),
          fetch("/api/exams"),
          fetch("/api/subscription"),
          fetch("/api/folders"),
          fetch("/api/streaks"),
          fetch("/api/notifications"),
        ]);

        // Tier 2 — deferred: non-critical data loaded after page renders
        const [adminRes, plansRes, weakRes, dueRes, aiConvsRes, profileRes] = [
          null, null, null, null, null, null
        ] as [Response | null, Response | null, Response | null, Response | null, Response | null, Response | null];

        // Fire deferred calls in background (don't await)
        Promise.all([
          fetch("/api/admin/check", { credentials: "include" }),
          fetch("/api/plans"),
          fetch("/api/flashcards/weak-areas"),
          fetch("/api/flashcards/due"),
          fetch("/api/ai/conversations"),
          fetch("/api/profile"),
        ]).then(async ([_adminRes, _plansRes, _weakRes, _dueRes, _aiConvsRes, _profileRes]) => {
          // Process deferred responses
          try {
            const adminJson = await _adminRes.json() as { data?: { isAdmin?: boolean } };
            if (adminJson?.data?.isAdmin) setIsAdmin(true);
          } catch { /* ignore */ }
          try {
            const plansJson = await _plansRes.json() as { data?: { plans?: StudyPlan[] } };
            setPlans(plansJson.data?.plans ?? []);
          } catch { /* ignore */ }
          try {
            const weakJson = await _weakRes.json() as { data?: { weak_areas?: WeakArea[] } };
            setWeakAreas(weakJson.data?.weak_areas ?? []);
          } catch { /* ignore */ }
          try {
            const dueJson = await _dueRes.json() as { data?: { flashcards?: Flashcard[] } };
            setDueFlashcards(dueJson.data?.flashcards ?? []);
          } catch { /* ignore */ }
          try {
            const aiConvsJson = await _aiConvsRes.json() as { data?: { conversations?: AIConversation[] } };
            setAiConversations(aiConvsJson.data?.conversations ?? []);
          } catch { /* ignore */ }
          try {
            const profileJson = await _profileRes.json() as { data?: { profile?: StudentProfile } };
            if (profileJson.data?.profile) setStudentProfile(profileJson.data.profile);
          } catch { /* ignore */ }
        }).catch(() => {});

        if (!meRes.ok) { router.replace("/login"); return; }

        const meJson = await meRes.json() as { data?: { user?: { id: string; email: string; avatar_url?: string | null } } };
        setUser({ id: meJson.data?.user?.id ?? "", email: meJson.data?.user?.email ?? "", avatarUrl: meJson.data?.user?.avatar_url ?? null });
        // Store in sessionStorage so avatar updates broadcast to this tab
        if (meJson.data?.user?.avatar_url) {
          sessionStorage.setItem("avatar_url", meJson.data.user.avatar_url);
        }

        if (notesRes.ok) {
          const j = await notesRes.json() as { data?: { notes: Note[] } };
          setNotes(Array.isArray(j.data?.notes) ? j.data.notes : []);
        }

        if (groupsRes.ok) {
          const j = await groupsRes.json() as { data?: { groups: Group[] } };
          setGroups(Array.isArray(j.data?.groups) ? j.data.groups : []);
        }

        if (examsRes.ok) {
          const j = await examsRes.json() as { data?: { exams: Exam[] } };
          const loaded = Array.isArray(j.data?.exams) ? j.data.exams : [];
          setExams(loaded);
          loaded.filter((e) => e.status === "pending").forEach((e) => startExamPolling(e.id));
        }

        if (subRes.ok) {
          const j = await subRes.json() as { data?: Subscription };
          if (j.data) setSubscription(j.data);
        }

        if (foldersRes.ok) {
          const j = await foldersRes.json() as { data?: { folders: Folder[]; uncategorized_count: number } };
          if (j.data) {
            setFolders(j.data.folders ?? []);
            setUncategorizedCount(j.data.uncategorized_count ?? 0);
          }
        }

        if (streaksRes.ok) {
          const j = await streaksRes.json() as { data?: StreakData | null };
          if (j.data) setStreak(j.data);
        }

        if (notifsRes.ok) {
          const j = await notifsRes.json() as { data?: { notifications: Notification[]; unread_count: number } };
          if (j.data) { setNotifications(j.data.notifications ?? []); setUnreadCount(j.data.unread_count ?? 0); }
        }
        if (!localStorage.getItem("studyhub_onboarding_complete")) {
          setOnboardingOpen(true);
        }
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handle(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [notifOpen]);

  // Keyboard shortcut: N = new note (when not typing in a field)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (tab === "notes") { e.preventDefault(); setNewNoteOpen(true); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab]);

  function handleNoteCreated(note: Note) {
    setNotes((prev) => [note, ...prev]);
    if (note.folder_id) {
      setFolders((fs) => fs.map((f) => f.id === note.folder_id ? { ...f, note_count: f.note_count + 1 } : f));
    } else {
      setUncategorizedCount((c) => c + 1);
    }
    startSummaryPolling(note.id);
  }
  function handleNoteDeleted(id: string) {
    const interval = pollIntervalsRef.current.get(id);
    if (interval !== undefined) { clearInterval(interval); pollIntervalsRef.current.delete(id); }
    setNotes((prev) => {
      const note = prev.find((n) => n.id === id);
      if (note?.folder_id) {
        setFolders((fs) => fs.map((f) => f.id === note.folder_id ? { ...f, note_count: Math.max(0, f.note_count - 1) } : f));
      } else if (note) {
        setUncategorizedCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
    setFlashcardsMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function markAllNotificationsRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifications([]);
    setUnreadCount(0);
  }

  function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  async function handleNotificationClick(notif: Notification) {
    if (!notif.is_read) {
      await fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH", credentials: "include" });
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setNotifOpen(false);
    router.push(notif.action_url);
  }

  async function recordFlashcardReview() {
    try {
      const res = await fetch("/api/streaks/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_type: "flashcard_reviewed" }),
      });
      if (!res.ok) return;
      const json = await res.json() as {
        data?: StreakData & { milestone: number | null; milestone_message: string | null }
      };
      if (json.data) {
        setStreak(json.data);
        if (json.data.milestone_message) {
          setMilestoneToast(json.data.milestone_message);
          setTimeout(() => setMilestoneToast(null), 5000);
        }
      }
    } catch { /* non-critical */ }
  }

  function openStudyModeWithCards(cards: Flashcard[], title: string, noteId: string | null = null) {
    setStudyNoteTitle(title);
    setStudyNoteId(noteId);
    setStudyFlashcards(cards);
    setCurrentCard(0);
    setFlipped(false);
    setSessionCorrect(0);
    setSessionIncorrect(0);
    setSessionDone(false);
    reviewedCardsRef.current = new Set();
    answeredCardsRef.current = new Set();
    setStudyMode(true);
  }

  async function recordAnswer(flashcardId: string, correct: boolean) {
    const noteId = studyNoteId ?? "";
    void fetch("/api/flashcards/performance", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId, noteId, correct }),
    }).catch(() => {});

    const total = studyFlashcards.length;
    answeredCardsRef.current.add(currentCard);
    if (correct) setSessionCorrect((c) => c + 1);
    else         setSessionIncorrect((c) => c + 1);

    if (answeredCardsRef.current.size >= total) {
      setSessionDone(true);
    } else {
      setCurrentCard((c) => (c + 1 < total ? c + 1 : 0));
      setFlipped(false);
    }
  }

  function startWeakAreaReview() {
    const cards: Flashcard[] = weakAreas.map((a) => ({
      id: a.flashcard_id,
      question: a.question,
      answer: a.answer,
    }));
    openStudyModeWithCards(cards, "Weak Areas Review");
  }

  function startDueReview() {
    const cards: Flashcard[] = dueCards.map((d) => ({
      id: d.flashcard_id,
      question: d.question,
      answer: d.answer,
    }));
    openStudyModeWithCards(cards, "Spaced Repetition Review");
  }

  async function openStudyMode(noteId: string, noteTitle: string) {
    setStudyNoteTitle(noteTitle);
    setStudyNoteId(noteId);
    setCurrentCard(0);
    setFlipped(false);
    setSessionCorrect(0);
    setSessionIncorrect(0);
    setSessionDone(false);
    reviewedCardsRef.current = new Set();
    answeredCardsRef.current = new Set();
    setStudyMode(true);
    const cached = flashcardsMap[noteId];
    if (cached && cached.length > 0) {
      setStudyFlashcards(cached);
      return;
    }
    setStudyLoading(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/flashcards`);
      if (!res.ok) return;
      const json = await res.json() as { data?: { flashcards: Flashcard[] } };
      const cards = Array.isArray(json.data?.flashcards) ? json.data.flashcards : [];
      setStudyFlashcards(cards);
      setFlashcardsMap((prev) => ({ ...prev, [noteId]: cards }));
    } finally {
      setStudyLoading(false);
    }
  }
  async function openPlanDetail(plan: StudyPlan) {
    setSelectedPlan(plan);
    setPlanLoading(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}`);
      if (!res.ok) return;
      const j = await res.json() as { data?: { plan: StudyPlan; days: StudyPlanDay[] } };
      if (j.data) {
        setSelectedPlan(j.data.plan);
        setPlanDays(j.data.days);
      }
    } finally {
      setPlanLoading(false);
    }
  }

  async function togglePlanDay(planId: string, dayId: string, completed: boolean) {
    const res = await fetch(`/api/plans/${planId}/days/${dayId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_completed: completed }),
    });
    if (!res.ok) return;
    setPlanDays((prev) => prev.map((d) => d.id === dayId ? { ...d, is_completed: completed } : d));
    setPlans((prev) => prev.map((p) => {
      if (p.id !== planId) return p;
      const delta = completed ? 1 : -1;
      return { ...p, progress: { ...p.progress, completed: p.progress.completed + delta } };
    }));
  }

  async function deletePlan(planId: string) {
    const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    if (!res.ok) return;
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (selectedPlan?.id === planId) setSelectedPlan(null);
  }

  async function handleGenerateMore() {
    if (!studyNoteId) return;
    setGeneratingMore(true);
    try {
      const res = await fetch(`/api/notes/${studyNoteId}/flashcards/more`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json() as { data?: { flashcards: Flashcard[] } };
      if (json.data?.flashcards && json.data.flashcards.length > 0) {
        const newCards = json.data.flashcards;
        const firstNewIdx = studyFlashcards.length;
        setStudyFlashcards((prev) => [...prev, ...newCards]);
        setFlashcardsMap((prev) => ({
          ...prev,
          [studyNoteId]: [...(prev[studyNoteId] ?? []), ...newCards],
        }));
        setCurrentCard(firstNewIdx);
        setFlipped(false);
        setSessionDone(false);
        answeredCardsRef.current = new Set();
        setSessionCorrect(0);
        setSessionIncorrect(0);
      }
    } finally {
      setGeneratingMore(false);
    }
  }

  async function handleGenerateMoreForNote(noteId: string) {
    const res = await fetch(`/api/notes/${noteId}/flashcards/more`, {
      method: "POST",
      credentials: "include",
    });
    const json = await res.json() as { data?: { flashcards: Flashcard[] } };
    if (json.data?.flashcards && json.data.flashcards.length > 0) {
      setFlashcardsMap((prev) => ({
        ...prev,
        [noteId]: [...(prev[noteId] ?? []), ...json.data!.flashcards],
      }));
    }
  }

  function startPlanPoll(planId: string) {
    if (planPollRef.current) clearInterval(planPollRef.current);
    let elapsed = 0;
    planPollRef.current = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > 120_000) { clearInterval(planPollRef.current!); return; }
      try {
        const res = await fetch(`/api/plans/${planId}`);
        if (!res.ok) return;
        const j = await res.json() as { data?: { plan: StudyPlan; days: StudyPlanDay[] } };
        if (j.data?.plan.status === "ready") {
          clearInterval(planPollRef.current!);
          setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, status: "ready", progress: { total: j.data!.days.length, completed: 0 } } : p));
          setSelectedPlan(j.data.plan);
          setPlanDays(j.data.days);
        } else if (j.data?.plan.status === "failed") {
          clearInterval(planPollRef.current!);
          setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, status: "failed" } : p));
        }
      } catch { /* ignore */ }
    }, 3000);
  }

  function openEditNote(note: Note) {
    setEditNote(note);
    setEditTitle(note.title);
    setEditContent(note.content ?? "");
    setEditFolderId(note.folder_id ?? null);
  }

  async function handleSaveEdit() {
    if (!editNote || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${editNote.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:     editTitle.trim(),
          content:   editContent.trim() || null,
          folder_id: editFolderId,
        }),
      });
      if (res.ok) {
        setNotes((prev) => prev.map((n) =>
          n.id === editNote.id
            ? { ...n, title: editTitle.trim(), content: editContent.trim() || n.content, folder_id: editFolderId, ai_summary: null } as Note
            : n
        ));
        setEditNote(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEditFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/notes/extract-file", {
        method: "POST", credentials: "include", body: formData,
      });
      const json = await res.json() as { data?: { content: string } };
      if (res.ok && json.data?.content) {
        setEditContent((prev) => prev ? prev + "\n\n" + json.data!.content : json.data!.content);
      }
    } catch { /* silently ignore extraction errors */ }
    finally {
      setEditExtracting(false);
      e.target.value = "";
    }
  }

  async function openVersionHistory(note: Note) {
    setVersionHistoryNote(note);
    setVersions([]);
    setVersionPreview(null);
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/notes/${note.id}/versions`);
      if (!res.ok) return;
      const j = await res.json() as { data?: { versions: NoteVersion[] } };
      setVersions(Array.isArray(j.data?.versions) ? j.data.versions : []);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function previewVersion(noteId: string, versionNumber: number) {
    const res = await fetch(`/api/notes/${noteId}/versions/${versionNumber}`);
    if (!res.ok) return;
    const j = await res.json() as { data?: { version: { version_number: number; title: string; content: string | null } } };
    if (j.data?.version) setVersionPreview(j.data.version);
  }

  async function restoreVersion(noteId: string, versionNumber: number) {
    setRestoringVersion(versionNumber);
    try {
      const res = await fetch(`/api/notes/${noteId}/versions/${versionNumber}/restore`, { method: "POST" });
      if (!res.ok) return;
      const j = await res.json() as { data?: { note: Note } };
      if (j.data?.note) {
        setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, ...j.data!.note } : n));
      }
      setVersionHistoryNote(null);
      setVersionPreview(null);
    } finally {
      setRestoringVersion(null);
    }
  }

  async function handleExamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!examFile) { setExamError("Please select a file"); return; }
    setExamError("");
    setExamUploading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    try {
      const formData = new FormData();
      formData.append("title", examTitle);
      formData.append("file", examFile);
      const res = await fetch("/api/exams", { method: "POST", body: formData, signal: controller.signal });
      clearTimeout(timer);
      const json = await res.json() as { data?: { exam: Exam }; error?: string };
      if (res.status === 403) { showUpgradeModal(json.error ?? "Upgrade to unlock exam predictions."); return; }
      if (!res.ok) { setExamError(json.error ?? "Upload failed. Please try again."); return; }
      const newExam = json.data!.exam;
      setExams((prev) => [newExam, ...prev]);
      setExamTitle("");
      if (examImagePreview) URL.revokeObjectURL(examImagePreview);
      setExamFile(null);
      setExamImagePreview(null);
      startExamPolling(newExam.id);
    } catch (error) {
      clearTimeout(timer);
      console.error("[exam-upload] Error:", error);
      const isAbort = error instanceof Error && error.name === "AbortError";
      setExamError(isAbort ? "Upload timed out. Please try again." : "Network error. Please try again.");
    } finally {
      setExamUploading(false);
    }
  }

  function handleExamDeleted(id: string) { setExams((prev) => prev.filter((e) => e.id !== id)); }
  function handleGroupCreated(group: Group) { setGroups((prev) => [group, ...prev]); }
  function showUpgradeModal(message: string) { setUpgradeModalMessage(message); setUpgradeModalOpen(true); }

  function handleFolderCreated(folder: Folder) {
    setFolders((prev) => [...prev, folder]);
  }
  function handleFolderRenamed(updated: Folder) {
    setFolders((prev) => prev.map((f) => f.id === updated.id ? { ...f, name: updated.name } : f));
  }
  function handleFolderDeleted(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    // Notes that were in this folder become uncategorized — reflect in state
    setNotes((prev) => prev.map((n) => n.folder_id === id ? { ...n, folder_id: null } : n));
  }

  async function handleMoveToFolder(noteId: string, folderId: string | null) {
    // Optimistic update
    const prev = notes.find((n) => n.id === noteId);
    setNotes((ns) => ns.map((n) => n.id === noteId ? { ...n, folder_id: folderId } : n));
    // Update folder note_counts optimistically
    setFolders((fs) => fs.map((f) => {
      if (f.id === prev?.folder_id) return { ...f, note_count: Math.max(0, f.note_count - 1) };
      if (f.id === folderId) return { ...f, note_count: f.note_count + 1 };
      return f;
    }));
    if (!folderId && prev?.folder_id) {
      setUncategorizedCount((c) => c + 1);
    } else if (folderId && !prev?.folder_id) {
      setUncategorizedCount((c) => Math.max(0, c - 1));
    }
    // Persist
    await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
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

  if (loading) return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="h-6 w-28 rounded-md bg-muted animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Streak widget skeleton */}
        <div className="h-16 rounded-xl bg-muted animate-pulse" />

        {/* Tab bar skeleton */}
        <div className="flex gap-6 border-b border-border pb-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mb-2 h-8 w-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>

        {/* Note cards skeleton */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-6 w-16 rounded-full bg-muted animate-pulse shrink-0" />
              </div>
              <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded-lg bg-muted animate-pulse" />
                <div className="h-8 flex-1 rounded-lg bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  if (error)   return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-destructive">{error}</p></div>;

  // ── Full-screen flashcard study mode ──────────────────────────────────────
  if (studyMode) {
    const total = studyFlashcards.length;
    const card  = studyFlashcards[currentCard];

    // Session complete screen
    if (sessionDone) {
      const totalAnswered = sessionCorrect + sessionIncorrect;
      const pct = totalAnswered > 0 ? Math.round((sessionCorrect / totalAnswered) * 100) : 0;
      const msg = pct >= 80 ? "Excellent work! Keep it up 🏆" : pct >= 60 ? "Good effort! Review the tricky ones 💪" : "Keep practicing — you'll get there! 📚";
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6">
          <div className="text-5xl">{pct >= 80 ? "🏆" : pct >= 60 ? "💪" : "📚"}</div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-4xl font-bold text-accent">{sessionCorrect}/{totalAnswered} correct</p>
          <p className="text-muted-foreground">{msg}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => { setSessionDone(false); setCurrentCard(0); setFlipped(false); answeredCardsRef.current = new Set(); setSessionCorrect(0); setSessionIncorrect(0); }}
              className="rounded-xl border border-border px-6 py-3 text-sm font-medium hover:bg-muted">
              🔄 Study Again
            </button>
            {studyNoteId && (
              <button
                onClick={() => void handleGenerateMore()}
                disabled={generatingMore}
                className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {generatingMore
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Generating…</span>
                  : "➕ Generate 5 More"
                }
              </button>
            )}
            <button onClick={() => setStudyMode(false)}
              className="rounded-xl border border-border px-6 py-3 text-sm font-medium hover:bg-muted">
              Done
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={() => setStudyMode(false)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ← Back to Notes
          </button>
          <span className="text-sm text-muted-foreground">
            {studyLoading ? "Loading…" : total > 0 ? `${currentCard + 1} / ${total}` : ""}
          </span>
          <span className="max-w-[150px] truncate text-sm font-medium">{studyNoteTitle}</span>
        </div>

        {/* Progress bar */}
        {!studyLoading && total > 0 && (
          <div className="h-1 flex-shrink-0 bg-border">
            <div
              className="h-1 bg-accent transition-all duration-300"
              style={{ width: `${((currentCard + 1) / total) * 100}%` }}
            />
          </div>
        )}

        {/* Card area */}
        <div className="flex flex-1 items-center justify-center p-6">
          {studyLoading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading flashcards…</p>
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Generating flashcards… check back in a moment.</p>
            </div>
          ) : (
            <div
              onClick={() => {
                if (!flipped) {
                  // Record review the first time each card is flipped in this session
                  if (!reviewedCardsRef.current.has(currentCard)) {
                    reviewedCardsRef.current.add(currentCard);
                    void recordFlashcardReview();
                  }
                }
                setFlipped((v) => !v);
              }}
              role="button"
              aria-label={flipped ? "Show question" : "Show answer"}
              className="flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-accent bg-card p-8 shadow-lg shadow-accent/10 transition-all duration-200 active:scale-95"
              style={{ aspectRatio: "3/2" }}
            >
              <span className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {flipped ? "Answer" : "Question"}
              </span>
              <p className="text-center text-lg font-medium leading-relaxed">
                {flipped ? card?.answer : card?.question}
              </p>
              {!flipped && (
                <span className="mt-6 text-xs text-muted-foreground">Tap to reveal answer</span>
              )}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        {!studyLoading && total > 0 && (
          <div className="flex flex-shrink-0 gap-3 px-6 pb-4">
            {!flipped && (
              <button
                onClick={() => { setCurrentCard((c) => Math.max(0, c - 1)); setFlipped(false); }}
                disabled={currentCard === 0}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
              >
                ← Previous
              </button>
            )}
            {!flipped ? (
              <button
                onClick={() => {
                  if (!reviewedCardsRef.current.has(currentCard)) {
                    reviewedCardsRef.current.add(currentCard);
                    void recordFlashcardReview();
                  }
                  setFlipped(true);
                }}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Reveal Answer
              </button>
            ) : (
              <>
                <button
                  onClick={() => void recordAnswer(card.id, false)}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ThumbsDown className="h-4 w-4" /> Got it Wrong
                  </span>
                </button>
                <button
                  onClick={() => void recordAnswer(card.id, true)}
                  className="flex-1 rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
                >
                  <span className="flex items-center justify-center gap-2">
                    <ThumbsUp className="h-4 w-4" /> Got it Right
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Dot indicators */}
        {!studyLoading && total > 0 && (
          <div className="flex flex-shrink-0 justify-center gap-1.5 pb-6">
            {studyFlashcards.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentCard(i); setFlipped(false); }}
                aria-label={`Go to card ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-200",
                  i === currentCard ? "w-4 bg-accent" : "w-2 bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  function handleOnboardingClose() {
    localStorage.setItem("studyhub_onboarding_complete", "1");
    setOnboardingOpen(false);
  }
  function handleOnboardingCreateNote() {
    localStorage.setItem("studyhub_onboarding_complete", "1");
    setOnboardingOpen(false);
    setTab("notes");
    setNewNoteOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingModal
        open={onboardingOpen}
        onClose={handleOnboardingClose}
        onCreateFirstNote={handleOnboardingCreateNote}
      />
      <UpgradeModal
        open={upgradeModalOpen}
        message={upgradeModalMessage}
        onClose={() => setUpgradeModalOpen(false)}
      />
      <ConfirmDialog
        open={cancelSubOpen}
        title="Cancel subscription?"
        description="Your plan will remain active until the end of the current billing period, then revert to Free."
        confirmLabel="Cancel subscription"
        onConfirm={handleCancelSubscription}
        onCancel={() => setCancelSubOpen(false)}
        loading={cancellingSub}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <BookOpen className="h-5 w-5 text-orange-400" />
              <span className="hidden sm:inline font-bold text-orange-400">StudyHub</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {subscription?.tier === "free" && (
              <Button size="sm" className="hidden gap-1.5 bg-orange-500 text-white hover:bg-orange-600 sm:flex" asChild>
                <Link href="/pricing"><Zap className="h-3.5 w-3.5" />Upgrade</Link>
              </Button>
            )}
            <ThemeToggle />
            {/* Notifications bell */}
            <div className="relative" ref={notifRef}>
              <Tooltip label="Notifications" direction="below">
                <Button
                  variant="ghost" size="icon"
                  aria-label="Notifications"
                  onClick={() => setNotifOpen((o) => !o)}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Tooltip>
              {notifOpen && (
                <>
                  {/* Mobile backdrop — closes dropdown when tapped outside */}
                  <div
                    className="fixed inset-0 z-40 sm:hidden"
                    onClick={() => setNotifOpen(false)}
                  />
                  {/* Dropdown panel
                      Mobile:  fixed, centered, full-width minus 32px gutters
                      Desktop: absolute, right-anchored to bell icon            */}
                  <div className={cn(
                    "z-50 rounded-xl border border-border bg-card",
                    "shadow-[0_4px_20px_rgba(0,0,0,0.12)]",
                    // mobile
                    "fixed top-[60px] left-1/2 w-[calc(100vw-32px)] max-w-[380px] -translate-x-1/2",
                    // desktop
                    "sm:absolute sm:top-10 sm:right-0 sm:left-auto sm:w-80 sm:max-w-none sm:translate-x-0",
                  )}>
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="text-sm font-semibold">Notifications</p>
                      {unreadCount > 0 && (
                        <button onClick={markAllNotificationsRead} className="text-xs text-accent hover:underline">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No new notifications</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                          >
                            <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent text-sm font-medium">
                              {n.from_user?.full_name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm leading-snug break-words",
                                !n.is_read ? "font-medium text-foreground" : "text-muted-foreground"
                              )}>
                                {n.message}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{formatTimeAgo(n.created_at)}</p>
                            </div>
                            {!n.is_read && (
                              <div className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-accent" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Tooltip label="Help" direction="below">
              <Button variant="ghost" size="icon" onClick={() => setOnboardingOpen(true)} aria-label="Help">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </Tooltip>
            <AvatarDropdown email={user?.email ?? ""} plan={subscription?.tier} isAdmin={isAdmin} avatarUrl={user?.avatarUrl} />
          </div>
        </div>
      </header>

      {/* Milestone toast */}
      {milestoneToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-orange-500/30 bg-card px-5 py-3 text-sm font-medium shadow-lg shadow-orange-500/10 animate-in slide-in-from-bottom-4 duration-300">
          {milestoneToast}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="mx-auto flex max-w-4xl gap-0">
          {(
            [
              { id: "notes",   label: "Notes",   icon: <BookOpen className="h-4 w-4" /> },
              { id: "groups",  label: "Groups",  icon: <Users className="h-4 w-4" /> },
              { id: "exams",   label: "Exams",   icon: <GraduationCap className="h-4 w-4" /> },
              { id: "planner", label: "Planner", icon: <Calendar className="h-4 w-4" /> },
              { id: "ai",      label: "AI",      icon: <Bot className="h-4 w-4" /> },
            ] as const
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-sm font-medium transition-colors sm:flex-none sm:justify-start sm:px-4 sm:gap-2",
                tab === id
                  ? "border-orange-400 text-orange-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className={cn("mx-auto max-w-4xl px-4 sm:px-6", tab === "ai" ? "py-0" : "py-6 sm:py-8")}>

        {/* Streak widget — hidden on AI tab to maximise chat space */}
        {tab !== "ai" && streak && <StreakWidget streak={streak} />}

        {/* Student profile card */}
        {studentProfile && studentProfile.profileCompleteness >= 40 && (
          <ProfileCard
            profile={studentProfile}
            onRebuild={async () => {
              const res = await fetch("/api/profile");
              if (res.ok) {
                const j = await res.json() as { data?: { profile: StudentProfile } };
                if (j.data?.profile) setStudentProfile(j.data.profile);
              }
            }}
          />
        )}

        {/* Weak areas */}
        {weakAreas.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold">Weak Areas Detected</p>
                  <p className="text-xs text-muted-foreground">{weakAreas.length} flashcard{weakAreas.length !== 1 ? "s" : ""} need more practice</p>
                </div>
              </div>
              <button onClick={startWeakAreaReview}
                className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30">
                Review Now
              </button>
            </div>
            <div className="space-y-1.5">
              {weakAreas.slice(0, 3).map((area) => (
                <div key={area.flashcard_id} className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2">
                  <p className="flex-1 truncate text-sm">{area.question}</p>
                  <span className="ml-2 shrink-0 text-xs font-medium text-red-400">{area.accuracy_pct}% accurate</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Due for review */}
        {dueCards.length > 0 && (
          <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">📅 Cards Due for Review</p>
                <p className="text-xs text-muted-foreground">{dueCards.length} card{dueCards.length !== 1 ? "s" : ""} scheduled for today</p>
              </div>
              <button onClick={startDueReview}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                Start Review
              </button>
            </div>
          </div>
        )}

        {/* ── Notes tab ── */}
        {tab === "notes" && (
          <>
            {/* Move-to-folder modal */}
            <MoveFolderModal
              note={moveNoteTarget}
              folders={folders}
              onMove={handleMoveToFolder}
              onClose={() => setMoveNoteTarget(null)}
            />

            {/* Edit note modal */}
            <Dialog open={!!editNote} onOpenChange={(o) => { if (!o) setEditNote(null); }}>
              <DialogContent className="flex max-h-[90vh] flex-col p-0">
                <div className="shrink-0 border-b border-border px-6 pb-3 pt-6">
                  <DialogHeader><DialogTitle>Edit Note</DialogTitle></DialogHeader>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note title"
                      className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Content</label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-accent hover:underline">
                        <Paperclip className="h-3.5 w-3.5" />
                        {editExtracting ? "Extracting…" : "Upload document"}
                        <input type="file" className="hidden" accept=".txt,.pdf,.png,.jpg,.jpeg" onChange={handleEditFileUpload} />
                      </label>
                    </div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Note content…"
                      rows={8}
                      className="flex w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {folders.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Folder (optional)</label>
                      <select
                        value={editFolderId ?? ""}
                        onChange={(e) => setEditFolderId(e.target.value || null)}
                        className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  )}
                  {editNote?.ai_summary && (
                    <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
                      <p className="mb-1 text-xs font-medium text-accent">Current AI Summary</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{editNote.ai_summary.slice(0, 150)}…</p>
                      <p className="mt-1 text-xs italic text-muted-foreground">Summary will regenerate after saving</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
                  <Button variant="outline" onClick={() => setEditNote(null)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
                    {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Subscription status card for paid users */}
            {subscription && subscription.tier !== "free" && (
              <div className="mb-6 flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Zap className="h-4 w-4 text-orange-400" />
                  <div>
                    <span className="text-sm font-medium capitalize">{subscription.tier} plan</span>
                    {subscription.status && (
                      <span className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                        subscription.status === "active"    && "bg-green-500/20 text-green-400",
                        subscription.status === "past_due"  && "bg-yellow-500/20 text-yellow-400",
                        subscription.status === "cancelled" && "bg-muted text-muted-foreground",
                      )}>
                        {subscription.status.replace("_", " ")}
                      </span>
                    )}
                    {subscription.expires_at && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {subscription.status === "cancelled" ? "Active until" : "Renews"} {formatDate(subscription.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
                {subscription.status !== "cancelled" && (
                  <button onClick={() => setCancelSubOpen(true)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* Usage pills for free users */}
            {subscription?.tier === "free" && (
              <Link href="/pricing" className="mb-6 flex flex-wrap items-center gap-2">
                {(["notes", "ai_summaries", "flashcards"] as const).map((f) => {
                  const stat = subscription.usage[f];
                  if (!stat) return null;
                  const pct = stat.limit > 0 ? stat.used / stat.limit : 0;
                  return (
                    <span key={f} className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-orange-400",
                      pct >= 1 ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground",
                    )}>
                      {stat.used}/{stat.limit} {f.replace("_", " ")} this month
                    </span>
                  );
                })}
                <span className="rounded-full border border-orange-400/50 bg-orange-500/10 px-2.5 py-0.5 text-xs text-orange-400">
                  Upgrade for unlimited →
                </span>
              </Link>
            )}

            {/* Header row */}
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">My Notes</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notes.length === 0 ? "No notes yet" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <NewNoteDialog
                onCreated={handleNoteCreated}
                open={newNoteOpen}
                onOpenChange={setNewNoteOpen}
                onLimitReached={showUpgradeModal}
                folders={folders}
                initialFolderId={selectedFolderId === "uncategorized" ? null : selectedFolderId}
              />
            </div>

            {/* Mobile folder chips */}
            {folders.length > 0 && (
              <FolderChips
                folders={folders}
                selectedFolderId={selectedFolderId}
                uncategorizedCount={uncategorizedCount}
                onSelect={setSelectedFolderId}
              />
            )}

            {/* Desktop: sidebar + notes, Mobile: notes only (chips above) */}
            <div className="flex gap-6">
              {folders.length > 0 && (
                <FolderSidebar
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  uncategorizedCount={uncategorizedCount}
                  allCount={notes.length}
                  onSelect={setSelectedFolderId}
                  onFolderCreated={handleFolderCreated}
                  onFolderRenamed={handleFolderRenamed}
                  onFolderDeleted={handleFolderDeleted}
                />
              )}

              <div className="min-w-0 flex-1">
                {(() => {
                  const baseFiltered = selectedFolderId === null
                    ? notes
                    : selectedFolderId === "uncategorized"
                    ? notes.filter((n) => n.folder_id === null)
                    : notes.filter((n) => n.folder_id === selectedFolderId);
                  const filtered = noteSearch.trim()
                    ? baseFiltered.filter((n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()) || (n.content ?? "").toLowerCase().includes(noteSearch.toLowerCase()))
                    : baseFiltered;

                  if (baseFiltered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                        <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="font-medium">
                          {selectedFolderId ? "No notes in this folder" : "No study notes yet"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedFolderId ? "Move notes here or create a new one" : "Create your first note to get started"}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {/* Search + Bulk toolbar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[160px]">
                          <input
                            value={noteSearch}
                            onChange={(e) => setNoteSearch(e.target.value)}
                            placeholder="Search notes..."
                            className="h-8 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <svg className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        </div>
                        <button
                          onClick={() => { setBulkMode(v => !v); setBulkSelected(new Set()); }}
                          className={`h-8 rounded-lg border px-3 text-xs transition-colors ${bulkMode ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted"}`}
                        >
                          {bulkMode ? "Cancel" : "Select"}
                        </button>
                        {bulkMode && bulkSelected.size > 0 && (
                          <>
                            <button
                              onClick={() => setBulkSelected(new Set(filtered.map(n => n.id)))}
                              className="h-8 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
                            >Select all</button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete ${bulkSelected.size} note${bulkSelected.size > 1 ? "s" : ""}?`)) return;
                                for (const nid of bulkSelected) {
                                  await fetch(`/api/notes/${nid}`, { method: "DELETE" });
                                  handleNoteDeleted(nid);
                                }
                                setBulkSelected(new Set()); setBulkMode(false);
                              }}
                              className="h-8 rounded-lg border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"
                            >Delete ({bulkSelected.size})</button>
                            {groups.length > 0 && (
                              <div className="relative group/share">
                                <button className="h-8 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted">Share with group</button>
                                <div className="absolute left-0 top-9 z-20 hidden w-48 rounded-lg border border-border bg-card shadow-lg group-hover/share:block">
                                  {groups.map(g => (
                                    <button key={g.id}
                                      onClick={async () => {
                                        for (const noteId of bulkSelected) {
                                          await fetch(`/api/groups/${g.id}/notes`, {
                                            method: "POST", headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ noteId }),
                                          });
                                        }
                                        setBulkSelected(new Set()); setBulkMode(false);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted text-left">{g.name}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                const sel = filtered.filter(n => bulkSelected.has(n.id));
                                const text = sel.map(n => `*${n.title}*\n${n.content ?? ""}`).join("\n\n---\n\n");
                                window.open(`https://wa.me/?text=${encodeURIComponent(text.slice(0, 1000))}`, "_blank");
                              }}
                              className="h-8 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
                            >WhatsApp</button>
                            <button
                              onClick={() => {
                                const sel = filtered.filter(n => bulkSelected.has(n.id));
                                const body = sel.map(n => `${n.title}\n\n${n.content ?? ""}`).join("\n\n---\n\n");
                                const subject = sel.length === 1 ? sel[0].title : `${sel.length} Notes from StudyHub`;
                                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 2000))}`;
                              }}
                              className="h-8 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
                            >Email</button>
                          </>
                        )}
                      </div>

                      {filtered.length === 0 && noteSearch && (
                        <p className="py-8 text-center text-sm text-muted-foreground">No notes match &ldquo;{noteSearch}&rdquo;</p>
                      )}

                      {filtered.map((note) => (
                        <div key={note.id} className={bulkMode ? "relative pl-8" : ""}>
                          {bulkMode && (
                            <input type="checkbox" checked={bulkSelected.has(note.id)}
                              onChange={() => setBulkSelected(prev => {
                                const next = new Set(prev);
                                next.has(note.id) ? next.delete(note.id) : next.add(note.id);
                                return next;
                              })}
                              className="absolute left-0 top-4 h-5 w-5 accent-accent cursor-pointer"
                            />
                          )}
                          <NoteCard
                            note={note}
                            flashcardCount={flashcardsMap[note.id]?.length}
                            folder={folders.find((f) => f.id === note.folder_id)}
                            folders={folders}
                            onDelete={handleNoteDeleted}
                            onStudy={openStudyMode}
                            onMove={setMoveNoteTarget}
                            onHistory={openVersionHistory}
                            onEdit={openEditNote}
                            onGenerateMore={handleGenerateMoreForNote}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* First-time folder prompt */}
            {folders.length === 0 && notes.length > 0 && (
              <div className="mt-6 flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">Organize notes into folders</p>
                <CreateFolderDialog onCreated={handleFolderCreated} />
              </div>
            )}
          </>
        )}

        {/* ── Groups tab ── */}
        {tab === "groups" && (
          <>
            <div className="mb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">Study Groups</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {groups.length === 0 ? "No groups yet" : `${groups.length} group${groups.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="min-w-[44px]" asChild>
                    <Link href="/dashboard/groups/join">
                      <UserPlus className="h-[18px] w-[18px]" />
                      <span className="hidden sm:inline">Join group</span>
                    </Link>
                  </Button>
                  <CreateGroupDialog onCreated={handleGroupCreated} onLimitReached={showUpgradeModal} />
                </div>
              </div>
            </div>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No study groups yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a group or join one with an invite ID</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => <GroupCard key={group.id} group={group} />)}
              </div>
            )}
          </>
        )}
        {/* ── Exam Prep tab ── */}
        {tab === "exams" && (
          <>
            {/* Upload form */}
            <div className="mb-8 rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 font-semibold">Upload Past Exam</h2>
              <form onSubmit={handleExamSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exam-title">Exam title</Label>
                  <Input
                    id="exam-title"
                    placeholder="e.g. Biology Final 2024"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exam-file">Past exam file</Label>
                    <span className="text-xs text-muted-foreground">Max 10 MB · .txt, .pdf, .png, .jpg, .jpeg</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="exam-file"
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-orange-400 hover:text-orange-400"
                      >
                        <Upload className="h-4 w-4" />
                        {examFile ? (
                          <span className="flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono uppercase">
                              {examFile.name.split(".").pop()}
                            </span>
                            <span className="max-w-50 truncate">{examFile.name}</span>
                          </span>
                        ) : "Choose file"}
                        <input
                          id="exam-file"
                          type="file"
                          accept=".txt,.pdf,.png,.jpg,.jpeg"
                          className="sr-only"
                          onChange={(e) => handleExamFileChange(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {examFile && (
                        <button
                          type="button"
                          onClick={() => handleExamFileChange(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {examImagePreview && (
                      <img
                        src={examImagePreview}
                        alt="Preview"
                        className="h-24 w-auto rounded-md border border-border object-contain"
                      />
                    )}
                  </div>
                </div>
                {examError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{examError}</p>
                )}
                <Button type="submit" disabled={examUploading || !examFile}>
                  {examUploading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><GraduationCap className="h-4 w-4" />Analyze Exam</>}
                </Button>
              </form>
            </div>

            {/* Exam list */}
            <div>
              <h2 className="mb-4 font-semibold">
                {exams.length === 0 ? "No exams yet" : `${exams.length} exam${exams.length === 1 ? "" : "s"}`}
              </h2>
              {exams.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                  <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">No exams uploaded yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Upload a past exam to get AI-predicted questions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.map((exam) => (
                    <ExamCard
                      key={exam.id}
                      exam={exam}
                      onDelete={handleExamDeleted}
                      onAskAI={(q) => { setPrefilledQuestion(q); setTab("ai"); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {/* ── Planner tab ── */}
        {tab === "planner" && (
          <PlannerTab
            plans={plans}
            notes={notes}
            selectedPlan={selectedPlan}
            planDays={planDays}
            planLoading={planLoading}
            createPlanOpen={createPlanOpen}
            onCreatePlanOpen={() => setCreatePlanOpen(true)}
            onCreatePlanClose={() => setCreatePlanOpen(false)}
            onPlanCreated={(plan) => {
              setPlans((prev) => [plan, ...prev]);
              setSelectedPlan(plan);
              startPlanPoll(plan.id);
            }}
            onPlanSelect={openPlanDetail}
            onPlanBack={() => setSelectedPlan(null)}
            onDayToggle={togglePlanDay}
            onPlanDelete={deletePlan}
          />
        )}

        {/* ── AI Assistant tab ── */}
        {tab === "ai" && (
          <AIAssistantTab
            notes={notes}
            initialConversations={aiConversations}
            prefilledQuestion={prefilledQuestion}
            onClearPrefilledQuestion={() => setPrefilledQuestion(null)}
            onConversationsChange={setAiConversations}
            studentProfile={studentProfile}
          />
        )}

      </main>

      {/* Version history slide-over */}
      {versionHistoryNote && (
        <VersionHistorySlideOver
          note={versionHistoryNote}
          versions={versions}
          loading={versionsLoading}
          preview={versionPreview}
          restoringVersion={restoringVersion}
          onPreview={(vNum) => void previewVersion(versionHistoryNote.id, vNum)}
          onRestore={(vNum) => void restoreVersion(versionHistoryNote.id, vNum)}
          onClose={() => { setVersionHistoryNote(null); setVersionPreview(null); }}
        />
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// PlannerTab
// ---------------------------------------------------------------------------

function PlannerTab({
  plans, notes, selectedPlan, planDays, planLoading,
  createPlanOpen,
  onCreatePlanOpen, onCreatePlanClose, onPlanCreated,
  onPlanSelect, onPlanBack, onDayToggle, onPlanDelete,
}: {
  plans: StudyPlan[];
  notes: Note[];
  selectedPlan: StudyPlan | null;
  planDays: StudyPlanDay[];
  planLoading: boolean;
  createPlanOpen: boolean;
  onCreatePlanOpen: () => void;
  onCreatePlanClose: () => void;
  onPlanCreated: (plan: StudyPlan) => void;
  onPlanSelect: (plan: StudyPlan) => void;
  onPlanBack: () => void;
  onDayToggle: (planId: string, dayId: string, completed: boolean) => void;
  onPlanDelete: (planId: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  function daysUntil(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86_400_000);
    return diff;
  }

  if (selectedPlan) {
    const todayTask = planDays.find((d) => d.is_today);
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={onPlanBack} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            ← Back
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{selectedPlan.title}</h1>
            <p className="text-sm text-muted-foreground">
              📅 Exam on {new Date(selectedPlan.exam_date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              {" · "}
              {daysUntil(selectedPlan.exam_date)} day{daysUntil(selectedPlan.exam_date) !== 1 ? "s" : ""} away
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{selectedPlan.progress?.completed ?? planDays.filter(d => d.is_completed).length} of {selectedPlan.progress?.total ?? planDays.length} study days completed</span>
            <span className="text-muted-foreground">
              {selectedPlan.progress?.total ? Math.round(((selectedPlan.progress.completed) / selectedPlan.progress.total) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-border">
            <div
              className="h-2 rounded-full bg-accent transition-all"
              style={{ width: `${selectedPlan.progress?.total ? Math.round(((selectedPlan.progress.completed) / selectedPlan.progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>

        {selectedPlan.status === "generating" && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-6">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Generating your study plan… this takes about 20 seconds.</p>
          </div>
        )}

        {selectedPlan.status === "failed" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Failed to generate plan. Please delete and try again.
          </div>
        )}

        {/* Today's task highlight */}
        {todayTask && (
          <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">📚 Today</p>
            <p className="font-semibold">{todayTask.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{todayTask.description}</p>
          </div>
        )}

        {planLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {planDays.map((day) => (
              <div key={day.id} className={cn(
                "rounded-xl border p-4 transition-all",
                day.is_today  ? "border-accent/40 bg-accent/5" :
                day.is_past   ? "border-border/40 opacity-60" :
                "border-border bg-card",
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      day.is_completed ? "border-green-500 bg-green-500/20 text-green-400" : "border-border",
                    )}>
                      {day.is_completed && <Check className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(day.study_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                        </span>
                        {day.is_today && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">Today</span>}
                      </div>
                      <p className="mt-0.5 font-medium">{day.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{day.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDayToggle(day.plan_id, day.id, !day.is_completed)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      day.is_completed
                        ? "border border-border text-muted-foreground hover:text-foreground"
                        : "bg-accent text-accent-foreground hover:opacity-90",
                    )}
                  >
                    {day.is_completed ? "Undo" : "Mark Done"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Study Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">AI-generated day-by-day study schedules</p>
        </div>
        <button onClick={onCreatePlanOpen}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
          <span>+</span>
          <span className="hidden sm:inline"> Create Study Plan</span>
        </button>
      </div>

      {plans.length === 0 && !createPlanOpen ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No study plans yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a plan to get a day-by-day study schedule</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const days = daysUntil(plan.exam_date);
            return (
              <div key={plan.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{plan.title}</h3>
                      {plan.status === "generating" && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />Generating…
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{plan.subject}</p>
                    <span className={cn(
                      "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      days > 7  ? "bg-green-500/15 text-green-400" :
                      days >= 3 ? "bg-orange-500/15 text-orange-400" :
                      "bg-red-500/15 text-red-400",
                    )}>
                      <Clock className="h-3 w-3" />
                      {days > 0 ? `Exam in ${days} day${days !== 1 ? "s" : ""}` : "Exam today!"}
                    </span>
                  </div>
                  <button onClick={() => onPlanDelete(plan.id)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {plan.status === "ready" && plan.progress && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{plan.progress.completed}/{plan.progress.total} days completed</span>
                      <span>{plan.progress.total > 0 ? Math.round((plan.progress.completed / plan.progress.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border">
                      <div className="h-1.5 rounded-full bg-accent transition-all"
                        style={{ width: `${plan.progress.total > 0 ? (plan.progress.completed / plan.progress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onPlanSelect(plan)}
                    disabled={plan.status === "generating"}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    View Plan
                  </button>
                  <button onClick={() => onPlanDelete(plan.id)}
                    className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Plan Modal */}
      {createPlanOpen && (
        <CreatePlanModal
          notes={notes}
          onClose={onCreatePlanClose}
          onCreated={onPlanCreated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreatePlanModal
// ---------------------------------------------------------------------------

function CreatePlanModal({ notes, onClose, onCreated }: {
  notes: Note[];
  onClose: () => void;
  onCreated: (plan: StudyPlan) => void;
}) {
  const [title, setTitle]       = useState("");
  const [subject, setSubject]   = useState("");
  const [examDate, setExamDate] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const tomorrow = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  function toggleNote(id: string) {
    setSelectedNotes((prev) => prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedNotes.length === 0) { setError("Select at least one note"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, examDate, noteIds: selectedNotes }),
      });
      const j = await res.json() as { data?: { plan: StudyPlan }; error?: string };
      if (!res.ok) { setError(j.error ?? "Failed to create plan"); return; }
      onCreated(j.data!.plan);
      onClose();
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="relative flex w-full max-w-md flex-col max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl">
        <div className="shrink-0 flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Create Study Plan</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder="e.g. Biology Final Exam"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} required
                placeholder="e.g. Biology"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Exam Date</label>
              <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required min={tomorrow}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Select Notes</label>
                <button type="button" onClick={() => setSelectedNotes(notes.map((n) => n.id))}
                  className="text-xs text-accent hover:underline">Select all</button>
              </div>
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes yet — create some notes first.</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-border p-2">
                  {notes.map((note) => (
                    <label key={note.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input type="checkbox" checked={selectedNotes.includes(note.id)} onChange={() => toggleNote(note.id)}
                        className="accent-accent" />
                      <span className="truncate text-sm">{note.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          </div>
          <div className="shrink-0 flex gap-2 border-t border-border px-6 py-4">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Generating…</span> : "Generate Study Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VersionHistorySlideOver
// ---------------------------------------------------------------------------

function VersionHistorySlideOver({ note, versions, loading, preview, restoringVersion, onPreview, onRestore, onClose }: {
  note: Note;
  versions: NoteVersion[];
  loading: boolean;
  preview: { version_number: number; title: string; content: string | null } | null;
  restoringVersion: number | null;
  onPreview: (vNum: number) => void;
  onRestore: (vNum: number) => void;
  onClose: () => void;
}) {
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  function formatVersionDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ` ${time}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card">
        <div className="shrink-0 flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-semibold">Version History</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{note.title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Version list */}
          <div className="flex w-56 shrink-0 flex-col border-r border-border">
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : versions.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No saved versions yet. Edit this note to create versions.</p>
              ) : versions.map((v, i) => (
                <div key={v.id}
                  className={cn("mb-1 rounded-lg border p-3 cursor-pointer transition-colors",
                    preview?.version_number === v.version_number ? "border-accent/40 bg-accent/5" : "border-transparent hover:bg-muted",
                  )}
                  onClick={() => onPreview(v.version_number)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent">v{v.version_number}</span>
                    {i === 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">latest</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatVersionDate(v.created_at)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Preview pane */}
          <div className="flex flex-1 flex-col min-w-0">
            {preview ? (
              <>
                <div className="flex-1 overflow-y-auto p-4" style={{ WebkitOverflowScrolling: "touch" }}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">v{preview.version_number} — Title</p>
                  <p className="mb-4 font-semibold">{preview.title}</p>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Content</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview.content ?? "(no content)"}</p>
                </div>
                <div className="shrink-0 border-t border-border p-4">
                  {confirmRestore === preview.version_number ? (
                    <div className="rounded-lg border border-border bg-muted p-3">
                      <p className="mb-2 text-xs text-muted-foreground">Restore to v{preview.version_number}? Current version will be saved first.</p>
                      <div className="flex gap-2">
                        <button onClick={() => { onRestore(preview.version_number); setConfirmRestore(null); }}
                          disabled={restoringVersion !== null}
                          className="flex-1 rounded-lg bg-accent py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50">
                          {restoringVersion === preview.version_number ? "Restoring…" : "Restore"}
                        </button>
                        <button onClick={() => setConfirmRestore(null)}
                          className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:text-foreground">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmRestore(preview.version_number)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground">
                      <RotateCcw className="h-4 w-4" />
                      Restore this version
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Select a version to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIAssistantTab
// ---------------------------------------------------------------------------

function AIAssistantTab({
  notes, initialConversations, prefilledQuestion, onClearPrefilledQuestion, onConversationsChange, studentProfile,
}: {
  notes: Note[];
  initialConversations: AiConversation[];
  prefilledQuestion: string | null;
  onClearPrefilledQuestion: () => void;
  onConversationsChange: (convs: AiConversation[]) => void;
  studentProfile: StudentProfile | null;
}) {
  const [conversations, setConversations] = useState<AiConversation[]>(initialConversations);
  const [activeConvId, setActiveConvId]   = useState<string | null>(null);
  const [messages, setMessages]           = useState<AiMessage[]>([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [attachedNoteIds, setAttachedNoteIds]       = useState<string[]>([]);
  const [attachedFileName, setAttachedFileName]     = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [convLoading, setConvLoading]       = useState(false);
  const [extracting, setExtracting]         = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep parent in sync
  function syncConversations(next: AiConversation[]) {
    setConversations(next);
    onConversationsChange(next);
  }

  // When prefilledQuestion arrives, reset and pre-fill input
  useEffect(() => {
    if (prefilledQuestion) {
      setInput(`Give me a detailed exam answer to: ${prefilledQuestion}`);
      setActiveConvId(null);
      setMessages([]);
      onClearPrefilledQuestion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledQuestion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function loadConversation(convId: string) {
    setConvLoading(true);
    setActiveConvId(convId);
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`);
      if (!res.ok) return;
      const j = await res.json() as { data?: { messages: AiMessage[] } };
      setMessages(j.data?.messages ?? []);
    } finally { setConvLoading(false); }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    const msgText = input.trim();
    setInput("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, conversation_id: activeConvId ?? "", user_id: "", role: "user", content: msgText, attachments: [], created_at: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, message: msgText, attachedNoteIds, attachedFileContent }),
      });
      const j = await res.json() as { data?: { conversationId: string; message: string } };
      if (!res.ok) { setMessages((prev) => prev.filter((m) => m.id !== tempId)); return; }

      const { conversationId: convId, message: aiMsg } = j.data!;

      if (!activeConvId) {
        setActiveConvId(convId);
        const convsRes = await fetch("/api/ai/conversations");
        const cj = await convsRes.json() as { data?: { conversations: AiConversation[] } };
        syncConversations(cj.data?.conversations ?? []);
      } else {
        // Refresh the conversation's updated_at in the sidebar list
        syncConversations(conversations.map((c) =>
          c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
        ));
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const ts = new Date().toISOString();
        return [
          ...withoutTemp,
          { id: `u-${Date.now()}`, conversation_id: convId, user_id: "", role: "user" as const, content: msgText, attachments: [], created_at: ts },
          { id: `a-${Date.now()}`, conversation_id: convId, user_id: "", role: "assistant" as const, content: aiMsg, attachments: [], created_at: ts },
        ];
      });

      setAttachedNoteIds([]);
      setAttachedFileContent(null);
      setAttachedFileName(null);
    } finally { setSending(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/notes/extract-file", { method: "POST", body: fd });
      const j = await res.json() as { data?: { content: string } };
      if (res.ok && j.data?.content) { setAttachedFileContent(j.data.content); setAttachedFileName(file.name); }
    } finally { setExtracting(false); e.target.value = ""; }
  }

  async function deleteConversation(convId: string) {
    await fetch(`/api/ai/conversations/${convId}`, { method: "DELETE" });
    syncConversations(conversations.filter((c) => c.id !== convId));
    if (activeConvId === convId) { setActiveConvId(null); setMessages([]); }
  }

  function newConversation() {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setAttachedNoteIds([]);
    setAttachedFileContent(null);
    setAttachedFileName(null);
  }

  const SUGGESTIONS = [
    "Explain a concept from my notes",
    "Help me answer an exam question",
    "Quiz me on my weakest topics",
    "Summarise what I need to study",
  ];

  const greeting = (() => {
    if (!studentProfile) return null;
    const name = studentProfile.fullName ? `, ${studentProfile.fullName.split(" ")[0]}` : "";
    if (studentProfile.upcomingExams.length > 0) {
      const next = studentProfile.upcomingExams[0];
      const daysUntil = Math.ceil((new Date(next.examDate).getTime() - Date.now()) / 86_400_000);
      const timeStr = daysUntil <= 1 ? "tomorrow" : daysUntil <= 7 ? `in ${daysUntil} days` : `on ${new Date(next.examDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      return `Hi${name}! Your ${next.subject} exam is ${timeStr}. Ask me anything about it, or I can quiz you on your notes.`;
    }
    if (studentProfile.weakAreas.length > 0) {
      return `Hi${name}! I noticed you're finding **${studentProfile.weakAreas[0].topic}** tricky. Want to work through it together?`;
    }
    if (studentProfile.currentStreak > 2) {
      return `Hi${name}! You're on a ${studentProfile.currentStreak}-day streak — great work! What are we studying today?`;
    }
    if (studentProfile.recentTopics.length > 0) {
      return `Hi${name}! Last time you were studying **${studentProfile.recentTopics[0]}**. Want to continue or start something new?`;
    }
    return null;
  })();

  const hasContent = activeConvId !== null || messages.length > 0;

  return (
    <div className="flex h-[calc(100dvh-110px)] sm:h-[calc(100vh-220px)] sm:min-h-[500px] overflow-hidden rounded-xl border border-border bg-card">
      {/* Left panel — conversation list */}
      <div className="hidden w-60 shrink-0 flex-col border-r border-border sm:flex">
        <div className="shrink-0 border-b border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">💬 Conversations</p>
          <button
            onClick={newConversation}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">No conversations yet</p>
          ) : conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group/conv mb-1 flex cursor-pointer items-start justify-between rounded-lg p-2.5 transition-colors",
                activeConvId === conv.id ? "bg-accent/10 text-accent" : "hover:bg-muted",
              )}
              onClick={() => void loadConversation(conv.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{conv.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(conv.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); void deleteConversation(conv.id); }}
                className="ml-1 mt-0.5 shrink-0 opacity-0 transition-opacity group-hover/conv:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — chat area */}
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        {!hasContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <Bot className="h-8 w-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold">StudyHub AI Assistant</h2>
              {greeting ? (
                <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
                  <ReactMarkdown>{greeting}</ReactMarkdown>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Ask me anything about your studies</p>
              )}
            </div>
            <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="rounded-xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-accent hover:bg-muted hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {convLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.map((msg, i) => (
              <div key={msg.id || i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Bot className="h-3.5 w-3.5 text-accent" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-accent text-accent-foreground"
                    : "rounded-tl-sm border border-border bg-muted/50",
                )}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  ) : (
                    <div className="ai-message-content text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/50 px-4 py-3">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    AI is thinking
                    <span className="flex gap-0.5">
                      <span className="animate-bounce [animation-delay:0ms]">.</span>
                      <span className="animate-bounce [animation-delay:150ms]">.</span>
                      <span className="animate-bounce [animation-delay:300ms]">.</span>
                    </span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t border-border p-3">
          {/* Chips */}
          {(attachedNoteIds.length > 0 || attachedFileName) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachedNoteIds.map((nid) => {
                const note = notes.find((n) => n.id === nid);
                return (
                  <span key={nid} className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {note?.title ?? nid}
                    <button onClick={() => setAttachedNoteIds((prev) => prev.filter((id) => id !== nid))}>
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              {attachedFileName && (
                <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  📄 {attachedFileName}
                  <button onClick={() => { setAttachedFileName(null); setAttachedFileContent(null); }}>
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="mb-2 flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotePickerOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <BookOpen className="h-3.5 w-3.5" />Attach Notes
                {attachedNoteIds.length > 0 && (
                  <span className="rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {attachedNoteIds.length}
                  </span>
                )}
              </button>
              {notePickerOpen && (
                <div className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-xl border border-border bg-card shadow-xl">
                  <div className="p-2">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Select notes to attach</p>
                    <div className="max-h-48 overflow-y-auto">
                      {notes.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">No notes yet</p>
                      ) : notes.map((note) => (
                        <label key={note.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                          <input
                            type="checkbox"
                            checked={attachedNoteIds.includes(note.id)}
                            onChange={() => setAttachedNoteIds((prev) =>
                              prev.includes(note.id) ? prev.filter((id) => id !== note.id) : [...prev, note.id]
                            )}
                            className="accent-accent"
                          />
                          <span className="truncate text-xs">{note.title}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => setNotePickerOpen(false)}
                      className="mt-1 w-full rounded-lg bg-accent py-1.5 text-xs font-medium text-accent-foreground">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent">
              <Paperclip className="h-3.5 w-3.5" />
              {extracting ? <><Loader2 className="h-3 w-3 animate-spin" />Extracting…</> : "Attach File"}
              <input type="file" className="hidden" accept=".txt,.pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} disabled={extracting} />
            </label>
          </div>

          {/* Input + send */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
              placeholder="Ask anything about your studies… (Shift+Enter for new line)"
              rows={2}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Param reader — must be in its own component so Suspense can wrap it
// ---------------------------------------------------------------------------

function DashboardWithParams() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab: "notes" | "groups" | "exams" | "planner" | "ai" =
    rawTab === "groups"  ? "groups"  :
    rawTab === "exams"   ? "exams"   :
    rawTab === "planner" ? "planner" :
    rawTab === "ai"      ? "ai"      :
    "notes";
  return <DashboardPage initialTab={initialTab} />;
}

export default function Page() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <p className="text-muted-foreground">Loading…</p>
          </div>
        }
      >
        <DashboardWithParams />
      </Suspense>
    </ErrorBoundary>
  );
}
