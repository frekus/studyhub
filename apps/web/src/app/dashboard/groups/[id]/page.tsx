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
  Home, LogOut, Share2, Loader2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  shared_at: string;
  shared_by: string;
  study_notes: {
    id: string;
    title: string;
    content: string | null;
    ai_summary: string | null;
    created_at: string;
  } | null;
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
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaving, setLeaving]         = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

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
          const meJson = await meRes.json() as { data?: { user?: { id: string } } };
          setCurrentUserId(meJson.data?.user?.id ?? null);
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
    // Optimistic: add a placeholder — the real data comes from the API
    setSharedNotes((prev) => [
      {
        id: crypto.randomUUID(),
        shared_at: new Date().toISOString(),
        shared_by: "",
        study_notes: { id: noteId, title: note.title, content: null, ai_summary: null, created_at: new Date().toISOString() },
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

  const myRole = members.find((m) => m.user_id === currentUserId)?.role;

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error)   return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-destructive">{error}</p></div>;
  if (!group)  return null;

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
        {/* Back link */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => { /* set groups tab via URL state if needed */ }}
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
              Shared notes ({sharedNotes.length})
            </h2>
            {sharedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
                <BookOpen className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No notes shared yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Share one of your notes with this group</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sharedNotes.map((sn) => {
                  const note = sn.study_notes;
                  if (!note) return null;
                  return (
                    <div key={sn.id} className="rounded-xl border border-border/60 border-l-4 border-l-accent bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <p className="font-medium">{note.title}</p>
                      {note.ai_summary && (
                        <p className="mt-2 rounded-md bg-orange-500/10 px-3 py-1.5 text-sm text-orange-400">
                          {note.ai_summary}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Shared {new Date(sn.shared_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
