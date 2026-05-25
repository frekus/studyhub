"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowLeft, BookOpen, Users, Copy, Check,
  Home, LogOut, Share2, Loader2, Layers, Download, FileText,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  users: { id: string; full_name: string | null } | null;
}

interface Group {
  id: string;
  name: string;
  created_at: string;
}

interface SharedNote {
  id: string;
  note_id: string;
  group_id: string;
  shared_at: string;
  shared_by: string;
  sharer_name: string;
  title: string;
  content: string;
  ai_summary: string | null;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

interface MyNote {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// InviteDialog
// ---------------------------------------------------------------------------

function InviteDialog({ groupId }: { groupId: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(groupId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4" />Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite members</DialogTitle></DialogHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this group ID with anyone you want to invite. They can join at{" "}
          <strong className="text-foreground">/dashboard/groups/join</strong>.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
          <code className="flex-1 select-all break-all text-sm text-foreground">{groupId}</code>
          <button onClick={handleCopy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ShareNoteDialog
// ---------------------------------------------------------------------------

function ShareNoteDialog({ groupId, myNotes, onShared }: {
  groupId: string;
  myNotes: MyNote[];
  onShared: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!noteId) { setError("Select a note"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to share note"); return; }
      onShared(noteId);
      setNoteId("");
      setOpen(false);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Share2 className="h-4 w-4" />Share a note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Share a note with this group</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {myNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no notes to share yet.</p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="note-select" className="text-sm font-medium text-foreground">
                Select a note
              </label>
              <select
                id="note-select"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">— choose a note —</option>
                {myNotes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || myNotes.length === 0}>
              {loading ? "Sharing…" : "Share"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ViewNoteModal
// ---------------------------------------------------------------------------

function ViewNoteModal({ note, onClose }: { note: SharedNote | null; onClose: () => void }) {
  if (!note) return null;

  const dateStr = new Date(note.shared_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Dialog open={!!note} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col p-0">
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">{note.title}</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-xs text-muted-foreground">
            Shared by {note.sharer_name} · {dateStr}
          </p>
        </div>
        <div
          className="overflow-y-auto flex-1 px-6 py-4 space-y-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {note.ai_summary ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                AI Summary
              </p>
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-foreground">
                {note.ai_summary}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />Summary generating…
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Full Note
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {note.content || <span className="text-muted-foreground italic">No content</span>}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SharedNoteCard
// ---------------------------------------------------------------------------

function SharedNoteCard({ note, onView, onStudy }: {
  note: SharedNote;
  onView: (note: SharedNote) => void;
  onStudy: (noteId: string, noteTitle: string) => Promise<void>;
}) {
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`imported_${note.note_id}`) === "true";
  });
  const [importError, setImportError] = useState("");
  const [studyLoading, setStudyLoading] = useState(false);

  async function handleImport() {
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/notes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.note_id }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setImportError(json.error ?? "Import failed"); return; }
      localStorage.setItem(`imported_${note.note_id}`, "true");
      setImportDone(true);
    } catch {
      setImportError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  async function handleStudy() {
    setStudyLoading(true);
    try {
      await onStudy(note.note_id, note.title);
    } finally {
      setStudyLoading(false);
    }
  }

  const summaryPreview = note.ai_summary
    ? note.ai_summary.slice(0, 100) + (note.ai_summary.length > 100 ? "…" : "")
    : null;

  const dateStr = new Date(note.shared_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="rounded-xl border border-border/60 border-l-4 border-l-accent bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <p className="font-semibold leading-snug">{note.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Shared by {note.sharer_name} · {dateStr}
      </p>

      {summaryPreview ? (
        <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent leading-snug">
          {summaryPreview}
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground italic">
          <Loader2 className="h-3 w-3 animate-spin" />Summary generating…
        </p>
      )}

      {importError && (
        <p className="mt-2 text-xs text-destructive">{importError}</p>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onView(note)}>
          <FileText className="h-3.5 w-3.5" />View Note
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleStudy}
          disabled={studyLoading}
        >
          {studyLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Layers className="h-3.5 w-3.5" />}
          Flashcards
        </Button>

        {importDone ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-green-500" />Imported
          </span>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleImport}
            disabled={importing}
          >
            {importing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            {importing ? "Importing…" : "Import Note"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupDetailPage
// ---------------------------------------------------------------------------

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [group, setGroup]             = useState<Group | null>(null);
  const [members, setMembers]         = useState<Member[]>([]);
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [myNotes, setMyNotes]         = useState<MyNote[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("You");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving]         = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  // View note modal
  const [viewNote, setViewNote]       = useState<SharedNote | null>(null);

  // No-flashcards toast
  const [noCardsToast, setNoCardsToast] = useState("");

  // Full-screen flashcard study mode
  const [studyMode, setStudyMode]             = useState(false);
  const [studyFlashcards, setStudyFlashcards] = useState<Flashcard[]>([]);
  const [studyNoteTitle, setStudyNoteTitle]   = useState("");
  const [currentCard, setCurrentCard]         = useState(0);
  const [flipped, setFlipped]                 = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [groupRes, notesRes, myNotesRes, meRes] = await Promise.all([
          fetch(`/api/groups/${id}`),
          fetch(`/api/groups/${id}/notes`),
          fetch("/api/notes"),
          fetch("/api/auth/me"),
        ]);

        if (groupRes.status === 401) { router.replace("/login"); return; }
        if (!groupRes.ok) { setError("Group not found or access denied"); return; }

        if (meRes.ok) {
          const meJson = await meRes.json() as { data?: { user?: { id: string; full_name?: string } } };
          setCurrentUserId(meJson.data?.user?.id ?? null);
          if (meJson.data?.user?.full_name) setCurrentUserName(meJson.data.user.full_name);
        }

        const groupJson = await groupRes.json() as { data?: { group: Group; members: Member[] } };
        setGroup(groupJson.data?.group ?? null);
        setMembers(groupJson.data?.members ?? []);

        if (notesRes.ok) {
          const j = await notesRes.json() as { data?: { notes: SharedNote[] } };
          setSharedNotes(Array.isArray(j.data?.notes) ? j.data.notes : []);
        }

        if (myNotesRes.ok) {
          const j = await myNotesRes.json() as { data?: { notes: MyNote[] } };
          setMyNotes(Array.isArray(j.data?.notes) ? j.data.notes : []);
        }
      } catch { setError("Failed to load group"); }
      finally { setLoading(false); }
    }
    load();
  }, [id, router]);

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

  function handleNoteShared(noteId: string) {
    const note = myNotes.find((n) => n.id === noteId);
    if (!note) return;
    setSharedNotes((prev) => [
      {
        id: crypto.randomUUID(),
        note_id: noteId,
        group_id: id,
        shared_at: new Date().toISOString(),
        shared_by: currentUserId ?? "",
        sharer_name: currentUserName,
        title: note.title,
        content: "",
        ai_summary: null,
      },
      ...prev,
    ]);
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/groups/${id}/leave`, { method: "POST" });
      if (res.ok) { router.push("/dashboard?tab=groups"); }
    } finally { setLeaving(false); }
  }

  async function openStudyMode(noteId: string, noteTitle: string): Promise<void> {
    try {
      const res = await fetch(`/api/notes/${noteId}/flashcards`);
      if (!res.ok) { showNoCards("Failed to load flashcards."); return; }
      const json = await res.json() as { data?: { flashcards: Flashcard[] } };
      const cards = Array.isArray(json.data?.flashcards) ? json.data.flashcards : [];
      if (cards.length === 0) {
        showNoCards("Flashcards are being generated. Check back in a moment.");
        return;
      }
      setStudyFlashcards(cards);
      setStudyNoteTitle(noteTitle);
      setCurrentCard(0);
      setFlipped(false);
      setStudyMode(true);
    } catch {
      showNoCards("Failed to load flashcards.");
    }
  }

  function showNoCards(msg: string) {
    setNoCardsToast(msg);
    setTimeout(() => setNoCardsToast(""), 4000);
  }

  const myRole = members.find((m) => m.user_id === currentUserId)?.role;

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-destructive">{error}</p>
    </div>
  );
  if (!group) return null;

  // ── Full-screen flashcard study mode ──────────────────────────────────────
  if (studyMode) {
    const total = studyFlashcards.length;
    const card  = studyFlashcards[currentCard];

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={() => setStudyMode(false)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ← Back to Group
          </button>
          <span className="text-sm text-muted-foreground">{currentCard + 1} / {total}</span>
          <span className="max-w-37.5 truncate text-sm font-medium">{studyNoteTitle}</span>
        </div>

        <div className="h-1 shrink-0 bg-border">
          <div
            className="h-1 bg-accent transition-all duration-300"
            style={{ width: `${((currentCard + 1) / total) * 100}%` }}
          />
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div
            onClick={() => setFlipped((v) => !v)}
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
        </div>

        <div className="flex shrink-0 gap-3 px-6 pb-4">
          <button
            onClick={() => { setCurrentCard((c) => Math.max(0, c - 1)); setFlipped(false); }}
            disabled={currentCard === 0}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
          >
            ← Previous
          </button>
          {!flipped ? (
            <button
              onClick={() => setFlipped(true)}
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

        <div className="flex shrink-0 justify-center gap-1.5 pb-6">
          {studyFlashcards.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrentCard(i); setFlipped(false); }}
              aria-label={`Go to card ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all duration-200",
                i === currentCard ? "w-4 bg-accent" : "w-2 bg-border hover:bg-muted-foreground",
              )}
            />
          ))}
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <ConfirmDialog
        open={leaveConfirmOpen}
        title="Leave this group?"
        description={`You'll lose access to all shared notes in "${group.name}". You can rejoin later with the group ID.`}
        confirmLabel="Leave group"
        onConfirm={handleLeave}
        onCancel={() => setLeaveConfirmOpen(false)}
        loading={leaving}
      />

      <ViewNoteModal note={viewNote} onClose={() => setViewNote(null)} />

      {/* No-flashcards toast */}
      {noCardsToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-card px-5 py-3 text-sm shadow-lg">
          {noCardsToast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="font-bold text-orange-400">StudyHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Home"><Home className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{loggingOut ? "Logging out…" : "Log out"}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Link>

        {/* Group header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InviteDialog groupId={group.id} />
            <ShareNoteDialog groupId={group.id} myNotes={myNotes} onShared={handleNoteShared} />
            {myRole && myRole !== "owner" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeaveConfirmOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />Leave
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Members sidebar */}
          <aside className="lg:col-span-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2">
                  <span className="truncate text-sm">
                    {m.users?.full_name ?? `User ${m.user_id.slice(0, 8)}`}
                  </span>
                  {m.role === "owner" && (
                    <span className="ml-2 shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">owner</span>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* Shared notes */}
          <section className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Shared Notes (AI Summaries) ({sharedNotes.length})
            </h2>
            {sharedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No notes shared yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Share one of your notes with this group</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sharedNotes.map((sn) => (
                  <SharedNoteCard
                    key={sn.id}
                    note={sn}
                    onView={setViewNote}
                    onStudy={openStudyMode}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
