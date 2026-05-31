"use client";
import ReactMarkdown from "react-markdown";

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
  PlusCircle, Send, Trash2, Smile, Upload, ChevronRight, ChevronDown, ChevronUp,
  FlaskConical, Crown, Wifi, WifiOff, X, Settings, Pencil, History, RotateCcw,
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
  title: string | null;
  status: "pending" | "ready" | "failed";
  papers_count: number;
  members_count: number;
  predictions: PredictionItem[] | null;
  created_at: string;
}

interface ExamUpload {
  id: string;
  title: string;
  content: string;
  uploader_name: string;
  uploaded_by: string;
  created_at: string;
  is_own?: boolean;
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
function InviteDialog({ groupId, groupName, inviteCode }: { groupId: string; groupName: string; inviteCode?: string | null }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId]     = useState(false);
  const inviteLink = inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://studyhubai.xyz"}/join/${inviteCode}`
    : null;
  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); });
  }
  function handleCopyId() {
    navigator.clipboard.writeText(groupId).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); });
  }
  function handleWhatsApp() {
    if (!inviteLink) return;
    const msg = encodeURIComponent(`Join my study group "${groupName}" on StudyHub AI! 📚\n\nClick to join: ${inviteLink}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Users className="h-4 w-4" /><span className="hidden sm:inline ml-1.5">Invite</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite members to {groupName}</DialogTitle></DialogHeader>
        {inviteLink && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Share this link — anyone can click it to join instantly.</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
              <code className="flex-1 select-all break-all text-xs text-foreground">{inviteLink}</code>
              <button onClick={handleCopyLink} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                {copiedLink ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={handleCopyLink}>
                {copiedLink ? "✅ Copied!" : "Copy invite link"}
              </Button>
              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={handleWhatsApp}>
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white mr-1.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.535 5.875L.057 23.476a.75.75 0 0 0 .92.92l5.733-1.466A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.956 9.956 0 0 1-5.188-1.453l-.36-.215-3.795.97.999-3.687-.236-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                <span className="hidden sm:inline">WhatsApp</span>
              </Button>
            </div>
          </div>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">Or share the group ID manually:</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
            <code className="flex-1 select-all text-xs text-foreground">{groupId}</code>
            <button onClick={handleCopyId} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {copiedId ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Members can join at <strong className="text-foreground">Dashboard → Groups → Join</strong></p>
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
  onShared: (sharedNote: SharedNote) => void;
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
      const json = await res.json() as { data?: { sharedNote: SharedNote }; error?: string };
      if (!res.ok) { setError(json.error ?? "Failed to share note"); return; }
      if (json.data?.sharedNote) onShared(json.data.sharedNote);
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
        <Button size="sm"><Share2 className="h-4 w-4" /><span className="hidden sm:inline ml-1.5">Share a note</span></Button>
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

    function fetchComments() {
      fetch(`/api/groups/${groupId}/notes/${note!.note_id}/comments`)
        .then((r) => r.json())
        .then((j) => setComments(j.data?.comments ?? []));
    }

    fetchComments();

    // No filter — filtered realtime subscriptions can fail silently on some plans.
    // Instead refetch on any note_comments change. Channel name uses Date.now()
    // to avoid stale subscription collisions when the modal reopens.
    const supabase = getSupabase();
    const channel = supabase
      .channel(`comments-${note.note_id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "note_comments" }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [note?.note_id, groupId]);

  async function postComment() {
    if (!note || !newComment.trim()) return;
    setPosting(true);
    const commentText = newComment.trim();
    setNewComment("");

    const tempId = crypto.randomUUID();
    const tempComment: NoteComment = {
      id: tempId, user_id: "", content: commentText, reaction: null,
      commenter_name: "You", is_own: true, created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, tempComment]);

    try {
      const res = await fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (!res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setNewComment(commentText);
      }
      // Realtime will sync the confirmed row
    } finally {
      setPosting(false);
    }
  }

  async function postReaction(emoji: string) {
    if (!note) return;
    const tempId = crypto.randomUUID();
    setComments((prev) => [...prev, {
      id: tempId, user_id: "", content: null, reaction: emoji,
      commenter_name: "You", is_own: true, created_at: new Date().toISOString(),
    }]);
    await fetch(`/api/groups/${groupId}/notes/${note.note_id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: emoji }),
    });
    // Realtime will replace the temp row with the confirmed one
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

function SharedNoteCard({ note, onView, onStudy, isHighlighted }: {
  note: SharedNote;
  onView: (note: SharedNote) => void;
  onStudy: (noteId: string, noteTitle: string) => Promise<void>;
  isHighlighted?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [studyLoading, setStudyLoading] = useState(false);

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  async function handleStudy() {
    setStudyLoading(true);
    try { await onStudy(note.note_id, note.title); }
    finally { setStudyLoading(false); }
  }

  const rawSummary = note.ai_summary ? stripMarkdown(note.ai_summary) : null;
  const summaryPreview = rawSummary ? rawSummary.slice(0, 120) + (rawSummary.length > 120 ? "…" : "") : null;
  const dateStr = new Date(note.shared_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-xl border border-border/60 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md [border-left:4px_solid_hsl(var(--accent))]",
        isHighlighted && "border-accent ring-2 ring-accent/30 animate-pulse-once bg-accent/5"
      )}
    >
      <p className="font-semibold leading-snug">{note.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Shared by {note.sharer_name} · {dateStr}</p>
      {summaryPreview ? (
        <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent leading-snug">{summaryPreview}</p>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground italic">
          <Loader2 className="h-3 w-3 animate-spin" />Summary generating…
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        <button
          onClick={() => onView(note)}
          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <FileText className="h-3.5 w-3.5" />View & Comment
        </button>
        <button
          onClick={handleStudy}
          disabled={studyLoading}
          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {studyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
          Flashcards
        </button>
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
  const [notes, setNotes]                   = useState<GroupNote[]>([]);
  const [loading, setLoading]               = useState(true);
  const [createOpen, setCreateOpen]         = useState(false);
  const [title, setTitle]                   = useState("");
  const [content, setContent]               = useState("");
  const [creating, setCreating]             = useState(false);
  const [importing, setImporting]           = useState(false);
  const [editNote, setEditNote]             = useState<GroupNote | null>(null);
  const [editTitle, setEditTitle]           = useState("");
  const [editContent, setEditContent]       = useState("");
  const [saving, setSaving]                 = useState(false);
  const [deleteNoteConfirm, setDeleteNoteConfirm] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes]   = useState<Set<string>>(new Set());
  const [flashcardCounts, setFlashcardCounts] = useState<Record<string, number>>({});
  const [generatingCards, setGeneratingCards] = useState<string | null>(null);
  // Version history state
  const [versionNote, setVersionNote]       = useState<GroupNote | null>(null);
  const [versions, setVersions]             = useState<{id:string;version_number:number;title:string;content:string|null;editor_name:string;created_at:string}[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionPreview, setVersionPreview] = useState<{version_number:number;title:string;content:string|null}|null>(null);
  const [restoring, setRestoring]           = useState<string|null>(null);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/group-notes`)
      .then((r) => r.json())
      .then((j) => {
        const loaded = j.data?.notes ?? [];
        setNotes(loaded);
        // Load flashcard counts
        loaded.forEach((n: GroupNote) => {
          fetch(`/api/groups/${groupId}/group-notes/${n.id}/flashcards`)
            .then(r => r.json())
            .then(fj => setFlashcardCounts(prev => ({ ...prev, [n.id]: fj.data?.flashcards?.length ?? 0 })))
            .catch(() => {});
        });
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/notes/extract-file", { method: "POST", body: fd });
      const j = await res.json() as { data?: { content: string }; error?: string };
      if (res.ok && j.data?.content) {
        setContent(j.data.content);
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    } finally { setImporting(false); }
  }

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
      const newNote: GroupNote = j.data.note;
      setNotes((prev) => [newNote, ...prev]);
      setTitle(""); setContent(""); setCreateOpen(false);
      if (!newNote.ai_summary) {
        const pollId = setInterval(async () => {
          const r = await fetch(`/api/groups/${groupId}/group-notes/${newNote.id}`);
          const pj = await r.json() as { data?: { note: GroupNote } };
          const updated = pj.data?.note;
          if (updated?.ai_summary) {
            setNotes((prev) => prev.map((n) => n.id === newNote.id ? updated : n));
            clearInterval(pollId);
          }
        }, 3000);
        setTimeout(() => clearInterval(pollId), 60000);
      }
    }
    setCreating(false);
  }

  async function handleSave() {
    if (!editNote) return;
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}/group-notes/${editNote.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), content: editContent }),
    });
    const j = await res.json();
    if (res.ok) {
      setNotes((prev) => prev.map((n) => n.id === editNote.id ? { ...j.data.note, creator_name: n.creator_name } : n));
      setEditNote(null);
    }
    setSaving(false);
  }

  async function handleDelete(noteId: string) {
    const res = await fetch(`/api/groups/${groupId}/group-notes/${noteId}`, { method: "DELETE" });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  async function handleGenerateFlashcards(noteId: string) {
    setGeneratingCards(noteId);
    try {
      const res = await fetch(`/api/groups/${groupId}/group-notes/${noteId}/flashcards`, { method: "POST" });
      const j = await res.json() as { data?: { flashcards: {id:string}[] }; error?: string };
      if (res.ok) {
        setFlashcardCounts(prev => ({ ...prev, [noteId]: j.data?.flashcards?.length ?? 0 }));
      }
    } finally { setGeneratingCards(null); }
  }

  async function openVersionHistory(note: GroupNote) {
    setVersionNote(note);
    setVersionsLoading(true);
    setVersionPreview(null);
    const res = await fetch(`/api/groups/${groupId}/group-notes/${note.id}/versions`);
    const j = await res.json();
    setVersions(j.data?.versions ?? []);
    setVersionsLoading(false);
  }

  async function restoreVersion(noteId: string, versionId: string) {
    setRestoring(versionId);
    const res = await fetch(`/api/groups/${groupId}/group-notes/${noteId}/versions/${versionId}`, { method: "POST" });
    const j = await res.json();
    if (res.ok) {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...j.data.note, creator_name: n.creator_name } : n));
      setVersionNote(null); setVersionPreview(null); setVersions([]);
    }
    setRestoring(null);
  }

  function toggleExpand(noteId: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(noteId) ? next.delete(noteId) : next.add(noteId);
      return next;
    });
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex justify-center mb-3">
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" />Group Note
        </Button>
      </div>

      {/* Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader><DialogTitle>Create group note</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required
              className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content (optional)" rows={5}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
            {/* File import */}
            <label className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent ${importing ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload className="h-4 w-4" />
              {importing ? "Extracting…" : "Import from PDF, image or text file"}
              <input type="file" accept=".txt,.pdf,.png,.jpg,.jpeg" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); e.target.value = ""; }} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || importing}>{creating ? "Creating…" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {editNote && (
        <Dialog open onOpenChange={() => setEditNote(null)}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-xl">
            <DialogHeader><DialogTitle>Edit note</DialogTitle></DialogHeader>
            <div className="mt-4 space-y-3">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title"
                className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={12}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              <p className="text-xs text-muted-foreground">Saving creates a new version automatically.</p>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditNote(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteNoteConfirm}
        title="Delete this note?"
        description="This will permanently delete this group note and all its versions."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteNoteConfirm) void handleDelete(deleteNoteConfirm); setDeleteNoteConfirm(null); }}
        onCancel={() => setDeleteNoteConfirm(null)}
        loading={false}
      />

      {/* Version history slide-over */}
      {versionNote && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => { setVersionNote(null); setVersionPreview(null); }} />
          <div className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card">
            <div className="shrink-0 flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="font-semibold">Version History</h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{versionNote.title}</p>
              </div>
              <button onClick={() => { setVersionNote(null); setVersionPreview(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 min-h-0">
              <div className="flex w-56 shrink-0 flex-col border-r border-border">
                <div className="flex-1 overflow-y-auto p-2">
                  {versionsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : versions.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">No saved versions yet.</p>
                  ) : versions.map((v, i) => (
                    <div key={v.id}
                      className={cn("mb-1 rounded-lg border p-3 cursor-pointer transition-colors",
                        versionPreview?.version_number === v.version_number ? "border-accent/40 bg-accent/5" : "border-transparent hover:bg-muted")}
                      onClick={() => setVersionPreview({ version_number: v.version_number, title: v.title, content: v.content })}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-accent">v{v.version_number}</span>
                        {i === 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">latest</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.editor_name}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                {versionPreview ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">v{versionPreview.version_number} — Title</p>
                      <p className="mb-4 font-semibold">{versionPreview.title}</p>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Content</p>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{versionPreview.content ?? "(no content)"}</p>
                    </div>
                    <div className="shrink-0 border-t border-border p-4">
                      <button
                        onClick={() => void restoreVersion(versionNote.id, versions.find(v => v.version_number === versionPreview.version_number)?.id ?? "")}
                        disabled={restoring !== null}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {restoring ? "Restoring…" : "Restore this version"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Select a version to preview</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No group notes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create a shared note for the whole group</p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="h-4 w-4" />Create first note
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-border/60 bg-card p-4 w-full min-w-0 overflow-hidden [border-left:4px_solid_hsl(var(--accent))]">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    by {n.creator_name}
                    {n.last_editor_name && n.last_editor_name !== n.creator_name && ` · edited by ${n.last_editor_name}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  <button title="Edit note"
                    onClick={() => { setEditNote(n); setEditTitle(n.title); setEditContent(n.content ?? ""); }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button title="Version history"
                    onClick={() => void openVersionHistory(n)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <button title={expandedNotes.has(n.id) ? "Collapse" : "Expand"}
                    onClick={() => toggleExpand(n.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {expandedNotes.has(n.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {(n.created_by === currentUserId || isOwner) && (
                    <button title="Delete note"
                      onClick={() => setDeleteNoteConfirm(n.id)}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              {n.ai_summary ? (
                <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent break-words line-clamp-3">{n.ai_summary}</p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs italic text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />Generating AI summary…
                </p>
              )}

              {/* Flashcard button */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleGenerateFlashcards(n.id)}
                  disabled={generatingCards === n.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {generatingCards === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                  {generatingCards === n.id ? "Generating…" : "Flashcards"}
                  {(flashcardCounts[n.id] ?? 0) > 0 && (
                    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">{flashcardCounts[n.id]}</span>
                  )}
                </button>
              </div>

              {/* Expanded content */}
              {expandedNotes.has(n.id) && n.content && (
                <div className="mt-3 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed space-y-2">
                  {n.content.split(/
{2,}/).map((para, i) => (
                    para.trim() ? <ReactMarkdown key={i} className="[&>p]:mb-0">{para.trim()}</ReactMarkdown> : null
                  ))}
                </div>
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
  const [startError, setStartError] = useState("");
  const [joining, setJoining] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsWaiting, setFlashcardsWaiting] = useState(false);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof getSupabase>["channel"] extends (name: string) => infer R ? R : never | null>(null);
  const fcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHost = session?.host_id === currentUserId;

  const fetchSession = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/sessions/active`);
    const j = await res.json();
    setSession(j.data?.session ?? null);
  }, [groupId]);

  useEffect(() => {
    fetchSession().finally(() => setLoading(false));
  }, [fetchSession]);

  // Load flashcards when session has a note — with Realtime + polling fallback
  useEffect(() => {
    const noteId = session?.note_id;
    const sessionId = session?.id;
    if (!noteId || !sessionId) { setFlashcards([]); setFlashcardsWaiting(false); return; }

    let cancelled = false;

    async function fetchFlashcards() {
      // Use the group session route so non-host members can access the host's note flashcards
      const res = await fetch(`/api/groups/${groupId}/sessions/${sessionId}/flashcards`);
      const j = await res.json() as { data?: { flashcards: Flashcard[] } };
      const cards: Flashcard[] = j.data?.flashcards ?? [];
      if (cancelled) return;
      setFlashcards(cards);
      if (cards.length > 0) {
        setFlashcardsWaiting(false);
        // Stop polling once loaded
        if (fcPollRef.current) { clearInterval(fcPollRef.current); fcPollRef.current = null; }
      }
      return cards.length;
    }

    fetchFlashcards().then((count) => {
      if (cancelled) return;
      if (count === 0) {
        setFlashcardsWaiting(true);

        // Realtime: listen for INSERT on flashcards for this note
        const supabase = getSupabase();
        const fcChannel = supabase
          .channel(`flashcards-ready:${noteId}`)
          .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "flashcards",
            filter: `note_id=eq.${noteId}`,
          }, () => { void fetchFlashcards(); })
          .subscribe();

        // Polling fallback every 5 s
        fcPollRef.current = setInterval(() => { void fetchFlashcards(); }, 5000);

        // Cleanup on unmount or note change
        return () => {
          cancelled = true;
          void supabase.removeChannel(fcChannel);
          if (fcPollRef.current) { clearInterval(fcPollRef.current); fcPollRef.current = null; }
        };
      }
    });

    return () => {
      cancelled = true;
      if (fcPollRef.current) { clearInterval(fcPollRef.current); fcPollRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setStartError("");

    // Pre-check: note must already have flashcards
    try {
      const fcRes = await fetch(`/api/notes/${selectedNoteId}/flashcards`);
      const fcJson = await fcRes.json();
      const cards: Flashcard[] = fcJson.data?.flashcards ?? [];
      if (cards.length === 0) {
        setStartError("This note has no flashcards yet. Generate flashcards first before starting a session.");
        return;
      }
    } catch {
      setStartError("Could not verify flashcards. Please try again.");
      return;
    }

    const note = myNotes.find((n) => n.id === selectedNoteId);
    setStarting(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`/api/groups/${groupId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: selectedNoteId, noteTitle: note?.title }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const j = await res.json();
      console.log("Session start response:", res.status, j);
      if (!res.ok) {
        setStartError(j.error ?? "Failed to start session. Please try again.");
        return;
      }
      // Set session state synchronously so the Realtime subscription
      // useEffect fires on the next render before any further API calls
      setSession(j.data.session);
      setStartOpen(false);
    } catch (error) {
      clearTimeout(timer);
      console.error("Session start error:", error);
      if (error instanceof Error && error.name === "AbortError") {
        setStartError("Session timed out. Try again.");
      } else {
        setStartError("Failed to start session. Please try again.");
      }
    } finally {
      setStarting(false);
    }
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
        {startOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
            onClick={(ev) => { if (ev.target === ev.currentTarget) { setStartOpen(false); setStartError(""); } }}
          >
            <div className="mx-auto my-8 w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl" style={{ maxHeight: "90vh" }}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Start a live study session</h2>
                <button
                  type="button"
                  onClick={() => { setStartOpen(false); setStartError(""); }}
                  className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <form onSubmit={handleStart} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select a note with flashcards</label>
                  <select
                    value={selectedNoteId}
                    onChange={(e) => { setSelectedNoteId(e.target.value); setStartError(""); }}
                    className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">— choose a note —</option>
                    {myNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
                  </select>
                </div>
                {startError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{startError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setStartOpen(false); setStartError(""); }}>Cancel</Button>
                  <Button type="submit" disabled={starting || !selectedNoteId}>
                    {starting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Starting…</> : "Start"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {flashcardsWaiting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span>Generating flashcards…</span>
            </>
          ) : (
            <span>No flashcards found for this note.</span>
          )}
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

function ExamPredictionsTab({ groupId, currentUserId, members }: { groupId: string; currentUserId: string | null; members: Member[] }) {
  const [uploads, setUploads] = useState<ExamUpload[]>([]);
  const [predictions, setPredictions] = useState<GroupPrediction[]>([]);
  const [activePrediction, setActivePrediction] = useState<GroupPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewPaper, setViewPaper] = useState<ExamUpload | null>(null);
  const [deletingUpload, setDeletingUpload] = useState<string | null>(null);
  const [deletingPrediction, setDeletingPrediction] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [predictionTitle, setPredictionTitle] = useState("");
  const pollRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    fetch(`/api/groups/${groupId}/predictions`)
      .then((r) => r.json())
      .then((j) => {
        const raw: ExamUpload[] = j.data?.uploads ?? [];
        setUploads(raw.map((u) => ({ ...u, is_own: u.uploaded_by === currentUserId })));
        const preds: GroupPrediction[] = j.data?.predictions ?? [];
        setPredictions(preds);
        preds.filter((p) => p.status === "pending").forEach((p) => startPolling(p.id));
      })
      .finally(() => setLoading(false));
    return () => { pollRefs.current.forEach((t) => clearInterval(t)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, currentUserId]);

  function startPolling(predictionId: string) {
    if (pollRefs.current.has(predictionId)) return;
    const interval = setInterval(async () => {
      const r = await fetch(`/api/groups/${groupId}/predictions`);
      const j = await r.json();
      const updated: GroupPrediction | undefined = (j.data?.predictions ?? []).find(
        (p: GroupPrediction) => p.id === predictionId
      );
      if (updated && updated.status !== "pending") {
        setPredictions((prev) => prev.map((p) => p.id === predictionId ? updated : p));
        clearInterval(interval);
        pollRefs.current.delete(predictionId);
      }
    }, 3000);
    pollRefs.current.set(predictionId, interval);
    setTimeout(() => {
      clearInterval(interval);
      pollRefs.current.delete(predictionId);
    }, 120000);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) { setUploadError("Title and file are required"); return; }
    setUploading(true); setUploadError("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const fd = new FormData();
      fd.append("title", uploadTitle.trim());
      fd.append("file", uploadFile);
      const res = await fetch(`/api/groups/${groupId}/exam-uploads`, {
        method: "POST", body: fd, signal: controller.signal,
      });
      clearTimeout(timer);
      const j = await res.json();
      if (!res.ok) { setUploadError(j.error ?? "Upload failed. Please try again."); return; }
      setUploads((prev) => [{ ...j.data.upload, is_own: true }, ...prev]);
      setUploadTitle(""); setUploadFile(null); setUploadOpen(false);
    } catch (error) {
      clearTimeout(timer);
      console.error("Upload error:", error);
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUpload(uploadId: string) {
    if (!confirm("Delete this exam paper?")) return;
    setDeletingUpload(uploadId);
    try {
      const res = await fetch(`/api/groups/${groupId}/exam-uploads/${uploadId}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setUploads((prev) => prev.filter((u) => u.id !== uploadId));
    } finally {
      setDeletingUpload(null);
    }
  }

  async function handleDeletePrediction(predictionId: string) {
    if (!confirm("Delete this prediction batch?")) return;
    setDeletingPrediction(predictionId);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/predictions/${predictionId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        setPredictions((prev) => prev.filter((p) => p.id !== predictionId));
        if (activePrediction?.id === predictionId) setActivePrediction(null);
      }
    } finally {
      setDeletingPrediction(null);
    }
  }

  function openNameDialog() {
    if (uploads.length < 2) return;
    setPredictionTitle(
      `Batch ${predictions.length + 1} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    );
    setShowNameDialog(true);
  }

  async function handleGenerate(title?: string) {
    setShowNameDialog(false);
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/predictions`,
        {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title ?? "" }),
        }
      );
      const j = await res.json();
      console.log("[predictions] response:", res.status, j);
      if (res.ok) {
        const newPred: GroupPrediction = {
          id: j.data.predictionId,
          title: title ?? null,
          status: "pending",
          papers_count: uploads.length,
          members_count: 0,
          predictions: null,
          created_at: new Date().toISOString(),
          created_by: currentUserId,
        };
        setPredictions((prev) => [newPred, ...prev]);
        startPolling(j.data.predictionId);
      } else {
        console.error("[predictions] error:", j.error);
        alert("Error: " + (j.error ?? "Unknown error"));
      }
    } catch (e) {
      console.error("[predictions] fetch failed:", e);
      alert("Network error - check console");
    } finally {
      setGenerating(false);
    }
  }

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

        {uploadOpen && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm"
            onClick={(ev) => { if (ev.target === ev.currentTarget) setUploadOpen(false); }}
          >
            <div className="mx-auto my-8 w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl" style={{ maxHeight: "90vh" }}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upload exam paper</h2>
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <form onSubmit={handleUpload} className="space-y-3">
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
                {uploadError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{uploadError}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</> : "Upload"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {uploads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No papers uploaded yet
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-accent/50 hover:bg-muted/50"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setViewPaper(u)}>
                  <p className="truncate text-sm font-medium">{u.title}</p>
                  <p className="text-xs text-muted-foreground">
                    by {u.uploader_name} · {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ChevronRight
                    className="h-4 w-4 cursor-pointer text-muted-foreground"
                    onClick={() => setViewPaper(u)}
                  />
                  {u.is_own && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDeleteUpload(u.id); }}
                      disabled={deletingUpload === u.id}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      aria-label="Delete paper"
                    >
                      {deletingUpload === u.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View paper content modal */}
        {viewPaper && (
          <Dialog open={!!viewPaper} onOpenChange={(o) => { if (!o) setViewPaper(null); }}>
            <DialogContent className="flex max-h-[90vh] flex-col p-0">
              <div className="shrink-0 border-b border-border px-6 pb-3 pt-6">
                <DialogHeader>
                  <DialogTitle>{viewPaper.title}</DialogTitle>
                </DialogHeader>
                <p className="mt-1 text-xs text-muted-foreground">Uploaded by {viewPaper.uploader_name}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {viewPaper.content || "No content available"}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Generate button + name dialog */}
      <div>
        <Button
          size="sm"
          onClick={openNameDialog}
          disabled={generating || uploads.length < 2}
          className="w-full sm:w-auto"
        >
          <FlaskConical className="h-4 w-4" />
          {generating ? "Generating…" : "Generate New Predictions"}
        </Button>
        {uploads.length < 2 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Upload {2 - uploads.length} more paper{2 - uploads.length !== 1 ? "s" : ""} to enable predictions
          </p>
        )}
      </div>

      {/* Name dialog */}
      {showNameDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setShowNameDialog(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-base mb-1">Name this prediction</h3>
            <p className="text-xs text-muted-foreground mb-4">Give this batch a name to find it easily later</p>
            <input
              value={predictionTitle}
              onChange={(e) => setPredictionTitle(e.target.value)}
              placeholder="e.g. Final Exam Prep · June 2026"
              className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handleGenerate(predictionTitle); }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNameDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => void handleGenerate(predictionTitle)} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FlaskConical className="h-4 w-4" />Generate</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prediction history */}
      <div>
        <p className="mb-3 text-sm font-medium">Prediction History</p>
        {predictions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No predictions generated yet
          </div>
        ) : (
          <div className="space-y-3">
            {predictions.map((pred, index) => (
              <div key={pred.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">
                      {pred.title || `Batch ${predictions.length - index}`}
                      {pred.status === "pending" && " ⏳"}
                      {pred.status === "failed" && " ❌"}
                      {pred.status === "ready" && ` · ${pred.predictions?.length ?? 0} predictions`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pred.papers_count} paper{pred.papers_count !== 1 ? "s" : ""} · {new Date(pred.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {pred.created_by && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created by: <span className="font-medium text-foreground">
                          {pred.created_by === currentUserId
                            ? "You"
                            : members.find(m => m.user_id === pred.created_by)?.users?.full_name ?? "A member"}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {pred.status === "ready" && (
                      <Button size="sm" variant="outline" onClick={() => setActivePrediction(pred)}>
                        View
                      </Button>
                    )}
                    {pred.status === "failed" && (
                      <Button size="sm" variant="outline" onClick={openNameDialog}>
                        Retry
                      </Button>
                    )}
                    {pred.created_by === currentUserId && (
                      <button
                        onClick={() => void handleDeletePrediction(pred.id)}
                        disabled={deletingPrediction === pred.id}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                        title="Delete prediction"
                      >
                        {deletingPrediction === pred.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {pred.status === "pending" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analysing {pred.papers_count} paper{pred.papers_count !== 1 ? "s" : ""}…
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Predictions view modal */}
      <Dialog open={!!activePrediction} onOpenChange={(o) => { if (!o) setActivePrediction(null); }}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0">
          <div className="shrink-0 px-6 pt-6 pb-3 border-b border-border">
            <DialogHeader>
              <DialogTitle>
                {activePrediction?.title || "Exam Predictions"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-1">
              {activePrediction?.papers_count} paper{activePrediction?.papers_count !== 1 ? "s" : ""} · Generated {activePrediction?.created_at
                ? new Date(activePrediction.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : ""}
            </p>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3" style={{ WebkitOverflowScrolling: "touch" }}>
            {(activePrediction?.predictions ?? []).map((p, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug flex-1">{p.question}</p>
                  <span className={cn(
                    "shrink-0 text-xs font-semibold uppercase",
                    p.likelihood === "high" ? "text-green-500" :
                    p.likelihood === "medium" ? "text-yellow-500" :
                    "text-muted-foreground"
                  )}>
                    {p.likelihood}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.topic}</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{p.explanation}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

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
        setNewGroupName(groupJson.data?.group?.name ?? "");
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

  // Handle URL params: ?tab=... and ?highlight=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const highlightId = params.get("highlight");

    if (tabParam) {
      const validTabs: Tab[] = ["shared", "group-notes", "live", "leaderboard", "exam"];
      if (validTabs.includes(tabParam as Tab)) {
        setActiveTab(tabParam as Tab);
      }
    }

    if (highlightId) {
      setHighlightedNoteId(highlightId);
      setTimeout(() => setHighlightedNoteId(null), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: when any member shares a note, all members see it immediately
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`shared-notes-${id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "study_group_notes",
        filter: `group_id=eq.${id}`,
      }, async () => {
        const res = await fetch(`/api/groups/${id}/notes`);
        const j = await res.json() as { data?: { notes: SharedNote[] } };
        if (res.ok) setSharedNotes(Array.isArray(j.data?.notes) ? j.data.notes : []);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, currentUserId]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); }
    catch (e) { console.error("Logout error:", e); }
    finally { window.location.href = "/"; }
  }

  function handleNoteShared(sharedNote: SharedNote) {
    setSharedNotes((prev) => [sharedNote, ...prev]);
  }

  async function handleDeleteGroup() {
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) router.push("/dashboard?tab=groups");
    } finally {
      setDeletingGroup(false);
    }
  }

  async function handleRenameGroup() {
    if (!newGroupName.trim()) return;
    setRenamingGroup(true);
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (res.ok) setGroup((prev) => prev ? { ...prev, name: newGroupName.trim() } : prev);
    } finally {
      setRenamingGroup(false);
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the group?`)) return;
    const res = await fetch(`/api/groups/${id}/members/${userId}`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  async function handleRemoveAndBlock(userId: string, name: string) {
    if (!confirm(`Remove ${name} and block them from rejoining via invite link?`)) return;
    const res = await fetch(`/api/groups/${id}/members/${userId}?block=true`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.user_id !== userId));
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

      {/* Delete group confirmation */}
      <ConfirmDialog
        open={deleteGroupConfirm}
        title="Delete this group?"
        description={`This will permanently delete "${group.name}" and ALL shared notes, group notes, sessions and predictions. This cannot be undone.`}
        confirmLabel="Delete Group"
        onConfirm={handleDeleteGroup}
        onCancel={() => setDeleteGroupConfirm(false)}
        loading={deletingGroup}
      />

      {/* Group Settings modal */}
      <Dialog open={showGroupSettings} onOpenChange={setShowGroupSettings}>
        <DialogContent className="flex max-h-[90vh] flex-col p-0">
          <div className="shrink-0 border-b border-border px-6 pb-3 pt-6">
            <DialogHeader><DialogTitle>Group Settings</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* Rename */}
            <section>
              <h3 className="mb-3 text-sm font-semibold">Group Name</h3>
              <div className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  className="flex h-10 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button size="sm" onClick={handleRenameGroup} disabled={renamingGroup || !newGroupName.trim()}>
                  {renamingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </section>

            {/* Members */}
            <section>
              <h3 className="mb-3 text-sm font-semibold">Members ({members.length})</h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
                        {(m.users?.full_name ?? "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.users?.full_name ?? "Unknown"}</p>
                        <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                      </div>
                    </div>
                    {m.role !== "owner" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => void handleRemoveMember(m.user_id, m.users?.full_name ?? "this member")}
                          className="rounded-md border border-destructive/30 px-2.5 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                          title="Remove from group (can rejoin via invite)"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => void handleRemoveAndBlock(m.user_id, m.users?.full_name ?? "this member")}
                          className="rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20"
                          title="Remove and block from rejoining via invite link"
                        >
                          Remove & Block
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Danger zone */}
            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <h3 className="mb-1 text-sm font-semibold text-destructive">Danger Zone</h3>
              <p className="mb-3 text-xs text-muted-foreground">These actions cannot be undone.</p>
              <Button
                variant="outline" size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => { setShowGroupSettings(false); setDeleteGroupConfirm(true); }}
              >
                <Trash2 className="h-4 w-4" />Delete Group
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>

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

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 overflow-x-hidden">
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
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setShowGroupSettings(true)}>
                <Settings className="h-4 w-4" /><span className="hidden sm:inline">Settings</span>
              </Button>
            )}
            {myRole && myRole !== "owner" && (
              <Button variant="outline" size="sm" onClick={() => setLeaveConfirmOpen(true)} className="text-destructive hover:text-destructive">
                <LogOut className="h-4 w-4" /><span className="hidden sm:inline ml-1.5">Leave</span>
              </Button>
            )}
          </div>
        </div>

        {/* Members sidebar + content grid */}
        <div className="grid gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members ({members.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {(membersExpanded ? members : members.slice(0, 2)).map((m) => (
                <div key={m.id} className="flex min-w-0 max-w-[140px] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
                  <span className="truncate text-sm">{m.users?.full_name ?? `User ${m.user_id.slice(0, 8)}`}</span>
                  {m.role === "owner" && <Crown className="h-3 w-3 shrink-0 text-yellow-400" />}
                </div>
              ))}
            </div>
            {members.length > 2 && (
              <button
                onClick={() => setMembersExpanded((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-accent transition-colors hover:underline"
              >
                {membersExpanded ? (
                  <><ChevronUp className="h-3 w-3" />Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" />+{members.length - 2} more member{members.length - 2 !== 1 ? "s" : ""}</>
                )}
              </button>
            )}
          </aside>

          <section className="lg:col-span-3 min-w-0 overflow-hidden w-full">
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
              <div className="w-full min-w-0 overflow-hidden">
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
                        key={sn.id} note={sn}
                        onView={setViewNote} onStudy={openStudyMode}
                        isHighlighted={highlightedNoteId === sn.note_id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "group-notes" && (
              <div className="w-full min-w-0 overflow-hidden">
                <GroupNotesTab groupId={id} currentUserId={currentUserId} isOwner={isOwner} />
              </div>
            )}

            {activeTab === "live" && (
              <div className="w-full min-w-0 overflow-hidden">
                <LiveSessionTab groupId={id} currentUserId={currentUserId} myNotes={myNotes} />
              </div>
            )}

            {activeTab === "leaderboard" && (
              <div className="w-full min-w-0 overflow-hidden">
                <LeaderboardTab groupId={id} currentUserId={currentUserId} />
              </div>
            )}

            {activeTab === "exam" && (
              <div className="w-full min-w-0 overflow-hidden">
                <ExamPredictionsTab groupId={id} currentUserId={currentUserId} members={members} />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
