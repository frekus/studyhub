"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  ArrowLeft, BookOpen, Users, Copy, Check, Home, LogOut, Share2,
  Loader2, Layers, Download, FileText, Trophy, Play, Square,
  PlusCircle, Send, Trash2, Smile, Upload, ChevronRight,
  FlaskConical, Crown, Wifi, WifiOff,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";

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

interface GroupNote {
  id: string;
  title: string;
  content: string | null;
  ai_summary: string | null;
  creator_name: string;
  editor_name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface LiveSession {
  id: string;
  note_id: string | null;
  note_title: string | null;
  current_card_index: number;
  is_active: boolean;
  host_id: string;
  participant_count: number;
  is_participant: boolean;
}

interface LeaderboardEntry {
  user_id: string;
  name: string;
  score: number;
  notes_created: number;
  flashcards_reviewed: number;
  study_days: number;
  is_current_user: boolean;
  rank: number;
}

interface PredictionItem {
  question: string;
  topic: string;
  likelihood: "high" | "medium" | "low";
  explanation: string;
}

interface GroupPrediction {
  id: string;
  status: "pending" | "ready" | "failed";
  papers_count: number;
  members_count: number;
  predictions: PredictionItem[] | null;
  created_at: string;
}

interface ExamUpload {
  id: string;
  title: string;
  uploader_name: string;
  created_at: string;
}

interface NoteComment {
  id: string;
  user_id: string;
  content: string | null;
  reaction: string | null;
  commenter_name: string;
  is_own: boolean;
  created_at: string;
}

type Tab = "shared" | "group-notes" | "live" | "leaderboard" | "exam";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Supabase browser client (singleton)
// ---------------------------------------------------------------------------

let _supabase: ReturnType<typeof createBrowserClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _supabase;
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
        <Button variant="outline" size="sm"><Users className="h-4 w-4" />Invite</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite members</DialogTitle></DialogHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          Share this group ID. They can join at <strong className="text-foreground">/dashboard/groups/join</strong>.
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

function ShareNoteDialog({ groupId, myNotes, members, onShared }: {
  groupId: string;
  myNotes: MyNote[];
  members: Member[];
  onShared: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [noteId, setNoteId] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!noteId) { setError("Select a note"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, mentions }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to share note"); return; }
      onShared(noteId);
      setNoteId(""); setMentions([]); setOpen(false);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  function toggleMention(uid: string) {
    setMentions((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Share2 className="h-4 w-4" />Share a note</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Share a note with this group</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {myNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no notes to share yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="note-select" className="text-sm font-medium">Select a note</label>
                <select
                  id="note-select" value={noteId} onChange={(e) => setNoteId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— choose a note —</option>
                  {myNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              </div>
              {members.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Mention members (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button
                        key={m.id} type="button"
                        onClick={() => toggleMention(m.user_id)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          mentions.includes(m.user_id)
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        @{m.users?.full_name ?? "Member"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
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
// ViewNoteModal (shared note)
// ---------------------------------------------------------------------------

function ViewNoteModal({ note, groupId, currentUserId, onClose }: {
  note: SharedNote | null;
  groupId: string;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const REACTIONS = ["👍", "🔥", "💡", "❓", "👏"];

  useEffect(() => {
    if (!note) return;
    setComments([]);
    fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`)
      .then((r) => r.json())
      .then((j) => setComments(j.data?.comments ?? []));

    const supabase = getSupabase();
    const channel = supabase
      .channel(`comments:${note.note_id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "note_comments",
        filter: `note_id=eq.${note.note_id}`,
      }, () => {
        fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`)
          .then((r) => r.json())
          .then((j) => setComments(j.data?.comments ?? []));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [note, groupId]);

  async function postComment() {
    if (!note || !newComment.trim()) return;
    setPosting(true);
    await fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    setNewComment("");
    setPosting(false);
  }

  async function postReaction(emoji: string) {
    if (!note) return;
    await fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: emoji }),
    });
  }

  async function deleteComment(commentId: string) {
    if (!note) return;
    await fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments/${commentId}`, { method: "DELETE" });
  }

  if (!note) return null;
  const dateStr = new Date(note.shared_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <Dialog open={!!note} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col p-0">
        <div className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">{note.title}</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-xs text-muted-foreground">Shared by {note.sharer_name} · {dateStr}</p>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {note.ai_summary ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">AI Summary</p>
              <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm leading-relaxed">{stripMarkdown(note.ai_summary)}</div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />Summary generating…
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Note</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content || <span className="italic text-muted-foreground">No content</span>}</p>
          </div>

          {/* Reactions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reactions</p>
            <div className="flex gap-2">
              {REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => postReaction(emoji)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-base transition-colors hover:bg-muted">
                  {emoji}
                </button>
              ))}
            </div>
            {comments.filter((c) => c.reaction).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(
                  comments.filter((c) => c.reaction).reduce((acc, c) => {
                    acc[c.reaction!] = (acc[c.reaction!] ?? 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([emoji, count]) => (
                  <span key={emoji} className="rounded-full border border-border bg-muted px-2 py-0.5 text-sm">
                    {emoji} {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Comments</p>
            <div className="space-y-2">
              {comments.filter((c) => c.content).map((c) => (
                <div key={c.id} className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-foreground">{c.commenter_name}</span>
                    <p className="mt-0.5 text-sm">{c.content}</p>
                  </div>
                  {c.is_own && (
                    <button onClick={() => deleteComment(c.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newComment} onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
                placeholder="Add a comment…"
                className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={postComment} disabled={posting || !newComment.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SharedNoteCard
// ---------------------------------------------------------------------------

function SharedNoteCard({ note, currentUserId, onView, onStudy }: {
  note: SharedNote;
  currentUserId: string | null;
  onView: (note: SharedNote) => void;
  onStudy: (noteId: string, noteTitle: string) => Promise<void>;
}) {
  const isOwnNote = !!currentUserId && note.shared_by === currentUserId;
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`imported_${note.note_id}`) === "true";
  });
  const [importError, setImportError] = useState("");
  const [studyLoading, setStudyLoading] = useState(false);

  async function handleImport() {
    setImporting(true); setImportError("");
    try {
      const res = await fetch("/api/notes/import", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.note_id }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setImportError(json.error ?? "Import failed"); return; }
      localStorage.setItem(`imported_${note.note_id}`, "true");
      setImportDone(true);
    } catch { setImportError("Network error. Please try again."); }
    finally { setImporting(false); }
  }

  async function handleStudy() {
    setStudyLoading(true);
    try { await onStudy(note.note_id, note.title); }
    finally { setStudyLoading(false); }
  }

  const rawSummary = note.ai_summary ? stripMarkdown(note.ai_summary) : null;
  const summaryPreview = rawSummary ? rawSummary.slice(0, 120) + (rawSummary.length > 120 ? "…" : "") : null;
  const dateStr = new Date(note.shared_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md [border-left:4px_solid_hsl(var(--accent))]">
      <p className="font-semibold leading-snug">{note.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Shared by {note.sharer_name} · {dateStr}</p>
      {summaryPreview ? (
        <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent leading-snug">{summaryPreview}</p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground italic">
          <Loader2 className="h-3 w-3 animate-spin" />Summary generating…
        </p>
      )}
      {importError && <p className="mt-2 text-xs text-destructive">{importError}</p>}
      <div className="mt-3 space-y-1.5">
        {/* View — full width */}
        <button
          onClick={() => onView(note)}
          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <FileText className="h-3.5 w-3.5" />View & Comment
        </button>
        {/* Flashcards + Import/status — side by side */}
        <div className="flex gap-1.5">
          <button
            onClick={handleStudy}
            disabled={studyLoading}
            className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {studyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
            Flashcards
          </button>
          {isOwnNote ? (
            <span className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-muted py-2 text-xs font-medium text-muted-foreground">
              Your note
            </span>
          ) : importDone ? (
            <span className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-muted py-2 text-xs font-medium text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-green-500" />Imported
            </span>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {importing ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupNotesTab
// ---------------------------------------------------------------------------

function GroupNotesTab({ groupId, currentUserId, isOwner }: {
  groupId: string;
  currentUserId: string | null;
  isOwner: boolean;
}) {
  const [notes, setNotes] = useState<GroupNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [editNote, setEditNote] = useState<GroupNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/group-notes`)
      .then((r) => r.json())
      .then((j) => setNotes(j.data?.notes ?? []))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/groups/${groupId}/group-notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), content: content.trim() || null }),
    });
    const j = await res.json();
    if (res.ok) {
      setNotes((prev) => [j.data.note, ...prev]);
      setTitle(""); setContent(""); setCreateOpen(false);
    }
    setCreating(false);
  }

  async function handleSave() {
    if (!editNote) return;
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}/group-notes/${editNote.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    });
    const j = await res.json();
    if (res.ok) {
      setNotes((prev) => prev.map((n) => n.id === editNote.id ? j.data.note : n));
      setEditNote(null);
    }
    setSaving(false);
  }

  async function handleDelete(noteId: string) {
    const res = await fetch(`/api/groups/${groupId}/group-notes/${noteId}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{notes.length} collaborative note{notes.length !== 1 ? "s" : ""}</p>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="h-4 w-4" />New Group Note
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create group note</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Title" required
              className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Content (optional)"
              rows={5}
              className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {editNote && (
        <Dialog open onOpenChange={() => setEditNote(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Edit: {editNote.title}</DialogTitle></DialogHeader>
            <textarea
              value={editContent} onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              className="mt-4 flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditNote(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No group notes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a shared note for the whole group</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border/60 bg-card p-4 [border-left:4px_solid_hsl(var(--accent))]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">by {n.creator_name} · edited by {n.editor_name}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditNote(n); setEditContent(n.content ?? ""); }}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  {(n.created_by === currentUserId || isOwner) && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {n.ai_summary && (
                <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent">{n.ai_summary}</p>
              )}
              {n.content && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveSessionTab
// ---------------------------------------------------------------------------

function LiveSessionTab({ groupId, currentUserId, myNotes }: {
  groupId: string;
  currentUserId: string | null;
  myNotes: MyNote[];
}) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [startOpen, setStartOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof getSupabase>["channel"] extends (name: string) => infer R ? R : never | null>(null);

  const isHost = session?.host_id === currentUserId;

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/sessions/active`);
    const j = await res.json();
    setSession(j.data?.session ?? null);
  }, [groupId]);

  useEffect(() => {
    fetchSession().finally(() => setLoading(false));
  }, [fetchSession]);

  // Load flashcards when session has a note
  useEffect(() => {
    if (!session?.note_id) { setFlashcards([]); return; }
    fetch(`/api/notes/${session.note_id}/flashcards`)
      .then((r) => r.json())
      .then((j) => setFlashcards(j.data?.flashcards ?? []));
  }, [session?.note_id]);

  // Realtime subscription to session changes
  useEffect(() => {
    if (!session) return;
    const supabase = getSupabase();
    const ch = supabase
      .channel(`session:${session.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "study_sessions",
        filter: `id=eq.${session.id}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const row = payload.new as { current_card_index: number; is_active: boolean };
        if (!row.is_active) { setSession(null); return; }
        setSession((prev) => prev ? { ...prev, current_card_index: row.current_card_index } : prev);
      })
      .subscribe((status: string) => setConnected(status === "SUBSCRIBED"));

    channelRef.current = ch as unknown as typeof channelRef.current;
    return () => { void supabase.removeChannel(ch); setConnected(false); };
  }, [session?.id]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNoteId) return;
    const note = myNotes.find((n) => n.id === selectedNoteId);
    setStarting(true);
    const res = await fetch(`/api/groups/${groupId}/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId: selectedNoteId, noteTitle: note?.title }),
    });
    const j = await res.json();
    if (res.ok) { setSession(j.data.session); setStartOpen(false); }
    setStarting(false);
  }

  async function handleJoin() {
    if (!session) return;
    setJoining(true);
    await fetch(`/api/groups/${groupId}/sessions/${session.id}/join`, { method: "POST" });
    await fetchSession();
    setJoining(false);
  }

  async function handleEnd() {
    if (!session) return;
    await fetch(`/api/groups/${groupId}/sessions/${session.id}`, { method: "DELETE" });
    setSession(null);
  }

  async function navigate(index: number) {
    if (!session) return;
    await fetch(`/api/groups/${groupId}/sessions/${session.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_card_index: index }),
    });
    setSession((prev) => prev ? { ...prev, current_card_index: index } : prev);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!session) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Play className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No active session</p>
          <p className="mt-1 text-xs text-muted-foreground">Start a live session to study flashcards together</p>
          <Button className="mt-4 w-full sm:w-auto" size="sm" onClick={() => setStartOpen(true)}>
            <Play className="h-4 w-4" />Start session
          </Button>
        </div>
        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Start a live study session</DialogTitle></DialogHeader>
            <form onSubmit={handleStart} className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select a note with flashcards</label>
                <select
                  value={selectedNoteId} onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— choose a note —</option>
                  {myNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={starting || !selectedNoteId}>{starting ? "Starting…" : "Start"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const totalCards = flashcards.length;
  const cardIndex = Math.min(session.current_card_index, totalCards - 1);
  const card = flashcards[cardIndex];

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{session.note_title ?? "Live Session"}</span>
            <span className={cn("flex items-center gap-1 text-xs", connected ? "text-green-500" : "text-muted-foreground")}>
              {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {connected ? "Live" : "Connecting…"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{session.participant_count} participant{session.participant_count !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {!session.is_participant && !isHost && (
            <Button size="sm" onClick={handleJoin} disabled={joining}>
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
            </Button>
          )}
          {isHost && (
            <Button size="sm" variant="destructive" onClick={handleEnd}>
              <Square className="h-4 w-4" />End
            </Button>
          )}
        </div>
      </div>

      {/* Flashcard display */}
      {totalCards === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Flashcards are being generated for this note…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-1 rounded-full bg-border">
            <div className="h-1 rounded-full bg-accent transition-all duration-300" style={{ width: `${((cardIndex + 1) / totalCards) * 100}%` }} />
          </div>
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-accent bg-card p-8 text-center shadow-lg shadow-accent/10">
            <span className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Question {cardIndex + 1} / {totalCards}</span>
            <p className="text-lg font-medium leading-relaxed">{card?.question}</p>
            <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-4 w-full">{card?.answer}</p>
          </div>
          {isHost && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate(cardIndex - 1)} disabled={cardIndex === 0}>← Prev</Button>
              <Button className="flex-1" onClick={() => navigate(cardIndex + 1)} disabled={cardIndex >= totalCards - 1}>Next →</Button>
            </div>
          )}
          {!isHost && (
            <p className="text-center text-xs text-muted-foreground">The host controls navigation</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeaderboardTab
// ---------------------------------------------------------------------------

function LeaderboardTab({ groupId, currentUserId }: { groupId: string; currentUserId: string | null }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/leaderboard`)
      .then((r) => r.json())
      .then((j) => { setEntries(j.data?.leaderboard ?? []); setWeekStart(j.data?.week_start ?? ""); })
      .finally(() => setLoading(false));
  }, [groupId]);

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-400" />;
    if (rank === 2) return <span className="text-slate-400 font-bold text-sm">2</span>;
    if (rank === 3) return <span className="text-amber-600 font-bold text-sm">3</span>;
    return <span className="text-muted-foreground font-medium text-sm">{rank}</span>;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const weekLabel = weekStart ? new Date(weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Week of {weekLabel} · Score = notes×3 + flashcards×1 + days×5</p>
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <Trophy className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No activity this week yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.user_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
                entry.is_current_user ? "border-accent bg-accent/5" : "border-border/60 bg-card",
                entry.rank === 1 && "border-yellow-400/40 bg-yellow-400/5",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">{rankIcon(entry.rank)}</div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-sm">
                  {entry.name}{entry.is_current_user && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.notes_created} note{entry.notes_created !== 1 ? "s" : ""} · {entry.flashcards_reviewed} flashcards · {entry.study_days} day{entry.study_days !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right min-w-[40px]">
                <p className="font-bold text-sm">{entry.score}</p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExamPredictionsTab
// ---------------------------------------------------------------------------

function ExamPredictionsTab({ groupId }: { groupId: string }) {
  const [uploads, setUploads] = useState<ExamUpload[]>([]);
  const [prediction, setPrediction] = useState<GroupPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/predictions`)
      .then((r) => r.json())
      .then((j) => { setUploads(j.data?.uploads ?? []); setPrediction(j.data?.prediction ?? null); })
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (prediction?.status === "pending") {
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/groups/${groupId}/predictions`);
        const j = await r.json();
        const p = j.data?.prediction ?? null;
        setPrediction(p);
        if (p?.status !== "pending") clearInterval(pollRef.current!);
      }, 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [prediction?.status, groupId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) { setUploadError("Title and file are required"); return; }
    setUploading(true); setUploadError("");
    const fd = new FormData();
    fd.append("title", uploadTitle.trim());
    fd.append("file", uploadFile);
    const res = await fetch(`/api/groups/${groupId}/exam-uploads`, { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok) { setUploadError(j.error ?? "Upload failed"); setUploading(false); return; }
    setUploads((prev) => [j.data.upload, ...prev]);
    setUploadTitle(""); setUploadFile(null); setUploadOpen(false);
    setUploading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch(`/api/groups/${groupId}/predictions`, { method: "POST" });
    const j = await res.json();
    if (res.ok) setPrediction({ id: j.data.predictionId, status: "pending", papers_count: uploads.length, members_count: 0, predictions: null, created_at: new Date().toISOString() });
    setGenerating(false);
  }

  const likelihoodColor = (l: string) => l === "high" ? "text-green-500" : l === "medium" ? "text-yellow-500" : "text-muted-foreground";

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div>
        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Uploaded Papers ({uploads.length})</p>
            <p className="text-xs text-muted-foreground">Upload 2+ past exams to generate AI predictions</p>
          </div>
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />Upload Exam
          </Button>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload exam paper</DialogTitle></DialogHeader>
            <form onSubmit={handleUpload} className="mt-4 space-y-3">
              <input
                value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Paper title (e.g. 2023 Final Exam)"
                className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                type="file" accept=".txt,.pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent-foreground"
              />
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {uploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No papers uploaded yet
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{u.title}</p>
                  <p className="text-xs text-muted-foreground">by {u.uploader_name} · {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Predictions section */}
      <div>
        <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">AI Predictions</p>
          {uploads.length >= 2 && !prediction?.status.match(/pending|ready/) && (
            <Button size="sm" className="w-full sm:w-auto" onClick={handleGenerate} disabled={generating}>
              <FlaskConical className="h-4 w-4" />{generating ? "Generating…" : "Generate Predictions"}
            </Button>
          )}
        </div>

        {!prediction ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {uploads.length < 2 ? "Upload at least 2 exam papers to generate predictions" : "Click Generate Predictions to analyze all uploaded papers"}
          </div>
        ) : prediction.status === "pending" ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-sm">Analyzing {prediction.papers_count} paper{prediction.papers_count !== 1 ? "s" : ""}… This may take a minute.</p>
          </div>
        ) : prediction.status === "failed" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Prediction failed. Try generating again.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Based on {prediction.papers_count} paper{prediction.papers_count !== 1 ? "s" : ""} from {prediction.members_count} member{prediction.members_count !== 1 ? "s" : ""} · {new Date(prediction.created_at).toLocaleDateString()}</p>
            {(prediction.predictions ?? []).map((p, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug flex-1">{p.question}</p>
                  <span className={cn("shrink-0 text-xs font-semibold uppercase", likelihoodColor(p.likelihood))}>{p.likelihood}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.topic}</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{p.explanation}</p>
              </div>
            ))}
          </div>
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
  const [activeTab, setActiveTab]     = useState<Tab>("shared");
  const [viewNote, setViewNote]       = useState<SharedNote | null>(null);
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
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); }
    catch (e) { console.error("Logout error:", e); }
    finally { window.location.href = "/"; }
  }

  function handleNoteShared(noteId: string) {
    const note = myNotes.find((n) => n.id === noteId);
    if (!note) return;
    setSharedNotes((prev) => [{
      id: crypto.randomUUID(), note_id: noteId, group_id: id,
      shared_at: new Date().toISOString(), shared_by: currentUserId ?? "",
      sharer_name: currentUserName, title: note.title, content: "", ai_summary: null,
    }, ...prev]);
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/groups/${id}/leave`, { method: "POST" });
      if (res.ok) router.push("/dashboard?tab=groups");
    } finally { setLeaving(false); }
  }

  async function openStudyMode(noteId: string, noteTitle: string): Promise<void> {
    try {
      const res = await fetch(`/api/notes/${noteId}/flashcards`);
      if (!res.ok) { showNoCards("Failed to load flashcards."); return; }
      const json = await res.json() as { data?: { flashcards: Flashcard[] } };
      const cards = Array.isArray(json.data?.flashcards) ? json.data.flashcards : [];
      if (cards.length === 0) { showNoCards("Flashcards are being generated. Check back in a moment."); return; }
      setStudyFlashcards(cards); setStudyNoteTitle(noteTitle);
      setCurrentCard(0); setFlipped(false); setStudyMode(true);
    } catch { showNoCards("Failed to load flashcards."); }
  }

  function showNoCards(msg: string) {
    setNoCardsToast(msg);
    setTimeout(() => setNoCardsToast(""), 4000);
  }

  const myRole = members.find((m) => m.user_id === currentUserId)?.role;
  const isOwner = myRole === "owner";

  const TABS: { key: Tab; label: string }[] = [
    { key: "shared",       label: "Shared" },
    { key: "group-notes",  label: "Notes" },
    { key: "live",         label: "Live" },
    { key: "leaderboard",  label: "Board" },
    { key: "exam",         label: "Exams" },
  ];

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
          <div className="h-1 bg-accent transition-all duration-300" style={{ width: `${((currentCard + 1) / total) * 100}%` }} />
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div
            onClick={() => setFlipped((v) => !v)}
            role="button" aria-label={flipped ? "Show question" : "Show answer"}
            className="flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-accent bg-card p-8 shadow-lg shadow-accent/10 transition-all duration-200 active:scale-95"
            style={{ aspectRatio: "3/2" }}
          >
            <span className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{flipped ? "Answer" : "Question"}</span>
            <p className="text-center text-lg font-medium leading-relaxed">{flipped ? card?.answer : card?.question}</p>
            {!flipped && <span className="mt-6 text-xs text-muted-foreground">Tap to reveal answer</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-3 px-6 pb-4">
          <button
            onClick={() => { setCurrentCard((c) => Math.max(0, c - 1)); setFlipped(false); }}
            disabled={currentCard === 0}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-30"
          >← Previous</button>
          {!flipped ? (
            <button onClick={() => setFlipped(true)} className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
              Reveal Answer
            </button>
          ) : currentCard < total - 1 ? (
            <button onClick={() => { setCurrentCard((c) => c + 1); setFlipped(false); }} className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
              Next Card →
            </button>
          ) : (
            <button onClick={() => { setCurrentCard(0); setFlipped(false); }} className="flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90">
              Start Over 🎉
            </button>
          )}
        </div>
        <div className="flex shrink-0 justify-center gap-1.5 pb-6">
          {studyFlashcards.map((_, i) => (
            <button key={i} onClick={() => { setCurrentCard(i); setFlipped(false); }} aria-label={`Go to card ${i + 1}`}
              className={cn("h-2 rounded-full transition-all duration-200", i === currentCard ? "w-4 bg-accent" : "w-2 bg-border hover:bg-muted-foreground")} />
          ))}
        </div>
      </div>
    );
  }

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

      <ViewNoteModal note={viewNote} groupId={id} currentUserId={currentUserId} onClose={() => setViewNote(null)} />

      {noCardsToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-card px-5 py-3 text-sm shadow-lg">
          {noCardsToast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4">
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

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to dashboard
        </Link>

        {/* Group header */}
        <div className="mb-6 flex flex-col gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold break-words">{group.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InviteDialog groupId={group.id} />
            <ShareNoteDialog groupId={group.id} myNotes={myNotes} members={members} onShared={handleNoteShared} />
            {myRole && myRole !== "owner" && (
              <Button variant="outline" size="sm" onClick={() => setLeaveConfirmOpen(true)} className="text-destructive hover:text-destructive">
                <LogOut className="h-4 w-4" />Leave
              </Button>
            )}
          </div>
        </div>

        {/* Members sidebar + content grid */}
        <div className="grid gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 lg:flex-col lg:gap-0 lg:space-y-1.5">
                {members.map((m) => (
                  <div key={m.id} className="flex shrink-0 items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2 lg:shrink lg:w-full">
                    <span className="truncate text-sm whitespace-nowrap lg:whitespace-normal">{m.users?.full_name ?? `User ${m.user_id.slice(0, 8)}`}</span>
                    {m.role === "owner" && <Crown className="ml-2 h-3 w-3 shrink-0 text-yellow-400" />}
                  </div>
                ))}
              </div>
              {/* Fade hint for horizontal scroll on mobile */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent lg:hidden" />
            </div>
          </aside>

          <section className="lg:col-span-3">
            {/* Tabs */}
            <div className="mb-5 -mx-4 flex border-b border-border overflow-x-auto scrollbar-hide">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "flex-1 min-w-0 flex flex-col items-center gap-0.5",
                    "border-b-2 py-2 px-1 text-xs font-medium transition-colors",
                    activeTab === t.key
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.key === "shared"       && <Share2       className="h-4 w-4" />}
                  {t.key === "group-notes"  && <BookOpen      className="h-4 w-4" />}
                  {t.key === "live"         && <Play          className="h-4 w-4" />}
                  {t.key === "leaderboard"  && <Trophy        className="h-4 w-4" />}
                  {t.key === "exam"         && <FlaskConical  className="h-4 w-4" />}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "shared" && (
              sharedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                  <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No notes shared yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Share one of your notes with this group</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedNotes.map((sn) => (
                    <SharedNoteCard
                      key={sn.id} note={sn} currentUserId={currentUserId}
                      onView={setViewNote} onStudy={openStudyMode}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === "group-notes" && (
              <GroupNotesTab groupId={id} currentUserId={currentUserId} isOwner={isOwner} />
            )}

            {activeTab === "live" && (
              <LiveSessionTab groupId={id} currentUserId={currentUserId} myNotes={myNotes} />
            )}

            {activeTab === "leaderboard" && (
              <LeaderboardTab groupId={id} currentUserId={currentUserId} />
            )}

            {activeTab === "exam" && (
              <ExamPredictionsTab groupId={id} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
