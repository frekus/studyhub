"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
  Upload, CheckCircle2, XCircle, ChevronRight, HelpCircle, Zap,
  Folder, FolderOpen, Brain, Target, Star, FolderInput,
  Pencil, Check, X as XIcon, Bell,
} from "lucide-react";
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
}

interface User {
  id: string;
  email: string;
}

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
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  const last14 = streak.activity.slice(-14);

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left — current streak */}
        <div className="flex items-center gap-3">
          <span className={cn("text-3xl leading-none", isPulsing && "animate-pulse")}>
            {fireEmoji}
          </span>
          <div>
            <p className="text-2xl font-bold leading-none text-orange-400">
              {streak.current_streak}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">day streak</p>
          </div>
          {streak.studied_today && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
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
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-sm font-bold">{streak.longest_streak}</p>
            <p className="text-xs text-muted-foreground">Best</p>
          </div>
          <div>
            <p className="text-sm font-bold">{streak.total_study_days}</p>
            <p className="text-xs text-muted-foreground">Total days</p>
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

function NoteCard({ note, flashcardCount, folder, folders, onDelete, onStudy, onMove }: {
  note: Note;
  flashcardCount: number | undefined;
  folder?: Folder;
  folders: Folder[];
  onDelete: (id: string) => void;
  onStudy: (noteId: string, noteTitle: string) => void;
  onMove: (note: Note) => void;
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
          <button
            onClick={() => onMove(note)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:text-foreground"
            aria-label="Move to folder"
          >
            <FolderInput className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={() => setConfirmOpen(true)} className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:text-destructive" aria-label="Delete note">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {note.ai_summary ? (
        <>
          <p className="mt-3 rounded-md bg-orange-500/10 px-3 py-2 text-sm text-orange-400">{note.ai_summary}</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onStudy(note.id, note.title)}>
              <Layers className="h-3.5 w-3.5" />
              Flashcards
              {flashcardCount !== undefined && flashcardCount > 0 && (
                <span className="ml-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400">
                  {flashcardCount}
                </span>
              )}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />Generating summary…
        </p>
      )}
      {expanded && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>}
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

  // Sync folderId when initialFolderId changes (e.g. user selects folder then opens dialog)
  useEffect(() => { setFolderId(initialFolderId ?? null); }, [initialFolderId, open]);

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
        <Button><Plus className="h-4 w-4" />New note</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New study note</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input id="note-title" placeholder="e.g. Chapter 3 — Cellular Respiration" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-content">Content</Label>
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
        <Button><Plus className="h-4 w-4" />Create group</Button>
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
        <Button size="sm" variant="outline" className="shrink-0 min-w-[72px]" asChild>
          <Link href={`/dashboard/groups/${group.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />View
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictionCard
// ---------------------------------------------------------------------------

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const [expanded, setExpanded] = useState(false);

  const likelihoodStyles = {
    high:   "bg-green-500/20 text-green-400",
    medium: "bg-yellow-500/20 text-yellow-400",
    low:    "bg-red-500/20 text-red-400",
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-medium leading-snug">{prediction.question}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {prediction.topic}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", likelihoodStyles[prediction.likelihood])}>
          {prediction.likelihood} likelihood
        </span>
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        Why this question?
      </button>
      {expanded && (
        <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {prediction.explanation}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PredictionsModal
// ---------------------------------------------------------------------------

function PredictionsModal({ exam }: { exam: Exam }) {
  const [open, setOpen] = useState(false);
  const predictions = exam.predictions ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" />
          View Predictions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{exam.title} — Predicted Questions</DialogTitle>
        </DialogHeader>
        <p className="mt-1 text-xs text-muted-foreground">
          {predictions.length} predicted question{predictions.length !== 1 ? "s" : ""}. Click "Why this question?" to see the reasoning.
        </p>
        <div className="mt-4 space-y-3">
          {predictions.map((p, i) => <PredictionCard key={i} prediction={p} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ExamCard
// ---------------------------------------------------------------------------

function ExamCard({ exam, onDelete }: { exam: Exam; onDelete: (id: string) => void }) {
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
      <div className="group rounded-xl border border-border/60 border-l-4 border-l-accent bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{exam.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(exam.created_at)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {exam.status === "pending" && (
              <span className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-400">
                <Loader2 className="h-3 w-3 animate-spin" />Analyzing…
              </span>
            )}
            {exam.status === "ready" && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />Ready
              </span>
            )}
            {exam.status === "failed" && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400">
                <XCircle className="h-3.5 w-3.5" />Failed
              </span>
            )}
            {exam.status === "ready" && <PredictionsModal exam={exam} />}
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:text-destructive"
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

function DashboardPage({ initialTab }: { initialTab: "notes" | "groups" | "exams" }) {
  const router       = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [notes, setNotes]         = useState<Note[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [exams, setExams]         = useState<Exam[]>([]);
  const [folders, setFolders]     = useState<Folder[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [selectedFolderId, setSelectedFolderId]     = useState<string | null>(null);
  const [moveNoteTarget, setMoveNoteTarget]         = useState<Note | null>(null);
  const [tab, setTab]             = useState<"notes" | "groups" | "exams">(initialTab);
  const [newNoteOpen, setNewNoteOpen]             = useState(false);
  const [onboardingOpen, setOnboardingOpen]       = useState(false);
  const [subscription, setSubscription]           = useState<Subscription | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen]   = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");
  const [cancelSubOpen, setCancelSubOpen]         = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

  // Study mode state
  const [studyMode, setStudyMode]               = useState(false);
  const [studyFlashcards, setStudyFlashcards]   = useState<Flashcard[]>([]);
  const [studyNoteTitle, setStudyNoteTitle]     = useState("");
  const [studyLoading, setStudyLoading]         = useState(false);
  const [currentCard, setCurrentCard]           = useState(0);
  const [flipped, setFlipped]                   = useState(false);
  const reviewedCardsRef = useRef<Set<number>>(new Set());

  // Streak state
  const [streak, setStreak]             = useState<StreakData | null>(null);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  // Notifications state
  interface Notification { id: string; type: string; message: string; group_id: string | null; note_id: string | null; created_at: string; }
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
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 3000;
      if (elapsed > 60000) { clearInterval(interval); return; }
      try {
        const res = await fetch(`/api/notes/${noteId}/flashcards`);
        if (!res.ok) return;
        const json = await res.json() as { data?: { flashcards: Flashcard[] } };
        const cards = json.data?.flashcards;
        if (Array.isArray(cards) && cards.length > 0) {
          setFlashcardsMap((prev) => ({ ...prev, [noteId]: cards }));
          clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, 3000);
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

        if (!meRes.ok) { router.replace("/login"); return; }

        const meJson = await meRes.json() as { data?: { user?: { id: string; email: string } } };
        setUser({ id: meJson.data?.user?.id ?? "", email: meJson.data?.user?.email ?? "" });

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

  async function markNotificationRead(notifId: string) {
    await fetch(`/api/notifications/${notifId}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    setUnreadCount((c) => Math.max(0, c - 1));
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

  async function openStudyMode(noteId: string, noteTitle: string) {
    setStudyNoteTitle(noteTitle);
    setCurrentCard(0);
    setFlipped(false);
    reviewedCardsRef.current = new Set();
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
  async function handleExamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!examFile) { setExamError("Please select a file"); return; }
    setExamError("");
    setExamUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", examTitle);
      formData.append("file", examFile);
      const res = await fetch("/api/exams", { method: "POST", body: formData });
      const json = await res.json() as { data?: { exam: Exam }; error?: string };
      if (res.status === 403) { showUpgradeModal(json.error ?? "Upgrade to unlock exam predictions."); return; }
      if (!res.ok) { setExamError(json.error ?? "Upload failed"); return; }
      const newExam = json.data!.exam;
      setExams((prev) => [newExam, ...prev]);
      setExamTitle("");
      if (examImagePreview) URL.revokeObjectURL(examImagePreview);
      setExamFile(null);
      setExamImagePreview(null);
      startExamPolling(newExam.id);
    } catch { setExamError("Network error. Please try again."); }
    finally { setExamUploading(false); }
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Loading…</p></div>;
  if (error)   return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-destructive">{error}</p></div>;

  // ── Full-screen flashcard study mode ──────────────────────────────────────
  if (studyMode) {
    const total = studyFlashcards.length;
    const card  = studyFlashcards[currentCard];

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
            <button
              onClick={() => { setCurrentCard((c) => Math.max(0, c - 1)); setFlipped(false); }}
              disabled={currentCard === 0}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
            >
              ← Previous
            </button>
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
            ) : currentCard < total - 1 ? (
              <button
                onClick={() => { setCurrentCard((c) => c + 1); setFlipped(false); }}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Next Card →
              </button>
            ) : (
              <button
                onClick={() => { setCurrentCard(0); setFlipped(false); }}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Start Over 🎉
              </button>
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
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="font-bold text-orange-400">StudyHub</span>
          </Link>
          <div className="flex items-center gap-2">
            {subscription?.tier === "free" && (
              <Button size="sm" className="hidden gap-1.5 bg-orange-500 text-white hover:bg-orange-600 sm:flex" asChild>
                <Link href="/pricing"><Zap className="h-3.5 w-3.5" />Upgrade</Link>
              </Button>
            )}
            <ThemeToggle />
            {/* Notifications bell */}
            <div className="relative" ref={notifRef}>
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
              {notifOpen && (
                <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-xl">
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
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug">{n.message}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <button
                            onClick={() => markNotificationRead(n.id)}
                            className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Dismiss"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOnboardingOpen(true)} aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <AvatarDropdown email={user?.email ?? ""} plan={subscription?.tier} />
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
              { id: "notes",  label: "Notes",   icon: <BookOpen className="h-4 w-4" /> },
              { id: "groups", label: "Groups",  icon: <Users className="h-4 w-4" /> },
              { id: "exams",  label: "Exams",   icon: <GraduationCap className="h-4 w-4" /> },
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
              <span className="sm:hidden text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-6 py-8">

        {/* Streak widget */}
        {streak && <StreakWidget streak={streak} />}

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
            <div className="mb-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">My Notes</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {notes.length === 0 ? "No notes yet" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <NewNoteDialog
                    onCreated={handleNoteCreated}
                    open={newNoteOpen}
                    onOpenChange={setNewNoteOpen}
                    onLimitReached={showUpgradeModal}
                    folders={folders}
                    initialFolderId={selectedFolderId === "uncategorized" ? null : selectedFolderId}
                  />
                </div>
              </div>
              <div className="mt-3 sm:hidden">
                <NewNoteDialog
                  onCreated={handleNoteCreated}
                  open={newNoteOpen}
                  onOpenChange={setNewNoteOpen}
                  onLimitReached={showUpgradeModal}
                  folders={folders}
                  initialFolderId={selectedFolderId === "uncategorized" ? null : selectedFolderId}
                />
              </div>
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
                  const filtered = selectedFolderId === null
                    ? notes
                    : selectedFolderId === "uncategorized"
                    ? notes.filter((n) => n.folder_id === null)
                    : notes.filter((n) => n.folder_id === selectedFolderId);

                  if (filtered.length === 0) {
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
                    <div className="space-y-4">
                      {filtered.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          flashcardCount={flashcardsMap[note.id]?.length}
                          folder={folders.find((f) => f.id === note.folder_id)}
                          folders={folders}
                          onDelete={handleNoteDeleted}
                          onStudy={openStudyMode}
                          onMove={setMoveNoteTarget}
                        />
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
                <div className="hidden items-center gap-2 sm:flex">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/groups/join"><UserPlus className="h-4 w-4" />Join group</Link>
                  </Button>
                  <CreateGroupDialog onCreated={handleGroupCreated} onLimitReached={showUpgradeModal} />
                </div>
              </div>
              <div className="mt-3 flex gap-2 sm:hidden">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href="/dashboard/groups/join"><UserPlus className="h-4 w-4" />Join group</Link>
                </Button>
                <CreateGroupDialog onCreated={handleGroupCreated} onLimitReached={showUpgradeModal} />
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
                  {exams.map((exam) => <ExamCard key={exam.id} exam={exam} onDelete={handleExamDeleted} />)}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Param reader — must be in its own component so Suspense can wrap it
// ---------------------------------------------------------------------------

function DashboardWithParams() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab: "notes" | "groups" | "exams" =
    rawTab === "groups" ? "groups" : rawTab === "exams" ? "exams" : "notes";
  return <DashboardPage initialTab={initialTab} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <DashboardWithParams />
    </Suspense>
  );
}
