"use client";

import { useState } from "react";
import {
  Calendar, Check, Clock, Loader2, Trash2, X as XIcon,
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

export default function PlannerTab({
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
