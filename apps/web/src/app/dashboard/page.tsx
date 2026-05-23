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
}

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
// FlipCard
// ---------------------------------------------------------------------------

function FlipCard({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      className="cursor-pointer perspective-[700px]"
      onClick={() => setFlipped((v) => !v)}
      role="button"
      aria-label={flipped ? "Show question" : "Show answer"}
    >
      <div
        className="relative h-36 transition-transform duration-500 transform-3d"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4 backface-hidden">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Question</p>
          <p className="text-center text-sm font-medium">{card.question}</p>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 backface-hidden transform-[rotateY(180deg)]">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-orange-400 mb-2">Answer</p>
          <p className="text-center text-sm text-foreground">{card.answer}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlashcardsModal
// ---------------------------------------------------------------------------

function FlashcardsModal({ note, flashcards, loading, onOpen }: { note: Note; flashcards: Flashcard[] | undefined; loading: boolean; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) onOpen(note.id);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Flashcards
          {flashcards && flashcards.length > 0 && (
            <span className="ml-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400">
              {flashcards.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{note.title} — Flashcards</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading…</span>
            </div>
          ) : !flashcards || flashcards.length === 0 ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Generating flashcards…</span>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs text-muted-foreground">Click a card to flip it and reveal the answer.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {flashcards.map((card) => <FlipCard key={card.id} card={card} />)}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({ note, flashcards, flashcardsLoading, onDelete, onLoadFlashcards }: {
  note: Note;
  flashcards: Flashcard[] | undefined;
  flashcardsLoading: boolean;
  onDelete: (id: string) => void;
  onLoadFlashcards: (id: string) => void;
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
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
            <FlashcardsModal note={note} flashcards={flashcards} loading={flashcardsLoading} onOpen={onLoadFlashcards} />
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

function NewNoteDialog({ onCreated, open, onOpenChange, onLimitReached }: {
  onCreated: (note: Note) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLimitReached?: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
      const json = await res.json();
      if (res.status === 403) { onOpenChange(false); onLimitReached?.(json.error ?? "Note limit reached."); return; }
      if (!res.ok) { setError(json.error ?? "Failed to create note"); return; }
      onCreated(json.data?.note ?? json.data);
      setTitle(""); setContent(""); onOpenChange(false);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

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
    <div className="rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{group.name}</h3>
            {group.role === "owner" && (
              <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">owner</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {group.member_count} member{group.member_count === 1 ? "" : "s"} · Created {formatDate(group.created_at)}
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
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
  const [tab, setTab]             = useState<"notes" | "groups" | "exams">(initialTab);
  const [newNoteOpen, setNewNoteOpen]             = useState(false);
  const [onboardingOpen, setOnboardingOpen]       = useState(false);
  const [subscription, setSubscription]           = useState<Subscription | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen]   = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState("");
  const [cancelSubOpen, setCancelSubOpen]         = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

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
        const [meRes, notesRes, groupsRes, examsRes, subRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/notes"),
          fetch("/api/groups"),
          fetch("/api/exams"),
          fetch("/api/subscription"),
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
          // Resume polling for any exams that are still pending
          loaded.filter((e) => e.status === "pending").forEach((e) => startExamPolling(e.id));
        }

        if (subRes.ok) {
          const j = await subRes.json() as { data?: Subscription };
          if (j.data) setSubscription(j.data);
        }

        // Show onboarding for first-time users
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

  function handleNoteCreated(note: Note) {
    setNotes((prev) => [note, ...prev]);
    startSummaryPolling(note.id);
  }
  function handleNoteDeleted(id: string) {
    const interval = pollIntervalsRef.current.get(id);
    if (interval !== undefined) { clearInterval(interval); pollIntervalsRef.current.delete(id); }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setFlashcardsMap((prev) => { const next = { ...prev }; delete next[id]; return next; });
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
            <Button variant="ghost" size="icon" onClick={() => setOnboardingOpen(true)} aria-label="Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <AvatarDropdown email={user?.email ?? ""} plan={subscription?.tier} />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <div className="mx-auto flex max-w-4xl gap-0">
          {(
            [
              { id: "notes",  label: "My Notes",  icon: <BookOpen className="h-4 w-4" /> },
              { id: "groups", label: "Groups",     icon: <Users className="h-4 w-4" /> },
              { id: "exams",  label: "Exam Prep",  icon: <GraduationCap className="h-4 w-4" /> },
            ] as const
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === id
                  ? "border-orange-400 text-orange-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="mx-auto max-w-4xl px-6 py-8">

        {/* ── Notes tab ── */}
        {tab === "notes" && (
          <>
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

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">My Notes</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notes.length === 0 ? "No notes yet" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <NewNoteDialog onCreated={handleNoteCreated} open={newNoteOpen} onOpenChange={setNewNoteOpen} onLimitReached={showUpgradeModal} />
            </div>
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No study notes yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create your first note to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    flashcards={flashcardsMap[note.id]}
                    flashcardsLoading={fetchingFlashcards.has(note.id)}
                    onDelete={handleNoteDeleted}
                    onLoadFlashcards={loadFlashcards}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Groups tab ── */}
        {tab === "groups" && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Study Groups</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {groups.length === 0 ? "No groups yet" : `${groups.length} group${groups.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
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
