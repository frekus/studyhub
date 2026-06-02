"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bot, BookOpen, Loader2, Paperclip, Plus, Send, Trash2,
  X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  ai_summary: string | null;
  created_at: string;
  folder_id: string | null;
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

export default function AIAssistantTab({
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

  function syncConversations(next: AiConversation[]) {
    setConversations(next);
    onConversationsChange(next);
  }

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
    <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-xl border border-border bg-card">
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
      <div className="flex min-w-0 flex-1 flex-col">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
