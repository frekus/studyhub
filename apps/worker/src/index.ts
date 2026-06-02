import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createConnection } from "@studyhub/queue";
import type { NoteSummarizePayload, NoteFlashcardsPayload, ExamPredictPayload, GroupNoteSummarizePayload, GroupExamPredictPayload, StudyPlanGeneratePayload } from "@studyhub/queue";
import { createAdminClient } from "@studyhub/database";
import type { Json } from "@studyhub/database";
import { redis } from "@studyhub/cache";
import Anthropic from "@anthropic-ai/sdk";

const SUMMARIZE_QUEUE       = "note.summarize";
const FLASHCARDS_QUEUE      = "note.flashcards";
const EXAM_QUEUE            = "exam.predict";
const GROUP_SUMMARIZE_QUEUE = "group.note.summarize";
const GROUP_EXAM_QUEUE      = "group.exam.predict";
const STUDY_PLAN_QUEUE      = "study.plan.generate";

// ---------------------------------------------------------------------------
// Clients — initialised once per process
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createAdminClient();

// ---------------------------------------------------------------------------
// Plan limits (mirrored from plans.ts — worker cannot import from apps/web)
// ---------------------------------------------------------------------------

const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free:    { ai_summaries: 5,  flashcards: 5,  exam_predictions: 0 },
  popular: { ai_summaries: -1, flashcards: -1, exam_predictions: 3 },
  pro:     { ai_summaries: -1, flashcards: -1, exam_predictions: -1 },
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function checkWorkerLimit(
  userId: string,
  feature: "ai_summaries" | "flashcards" | "exam_predictions",
): Promise<{ allowed: boolean }> {
  const { data: userRow } = await supabase
    .from("users")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();

  const tier   = (userRow?.subscription_tier as string | null) ?? "free";
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;
  const limit  = limits[feature] ?? 0;

  if (limit === -1) return { allowed: true };
  if (limit === 0)  return { allowed: false };

  const month = currentMonth();
  const { data: usageRow } = await supabase
    .from("usage_tracking")
    .select("count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("month", month)
    .maybeSingle();

  const used = (usageRow?.count as number | null) ?? 0;
  return { allowed: used < limit };
}

async function incrementWorkerUsage(userId: string, feature: string): Promise<void> {
  const month = currentMonth();
  try {
    const { data: existing } = await supabase
      .from("usage_tracking")
      .select("count")
      .eq("user_id", userId)
      .eq("feature", feature)
      .eq("month", month)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("usage_tracking")
        .update({ count: (existing.count as number) + 1 })
        .eq("user_id", userId)
        .eq("feature", feature)
        .eq("month", month);
    } else {
      await supabase
        .from("usage_tracking")
        .insert({ user_id: userId, feature, month, count: 1 });
    }
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

async function generateSummary(title: string, content: string | null): Promise<string> {
  const body = content?.trim() || "(no content provided)";
  const result = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content:
          `Summarize the following study note in 2-3 concise sentences.\n\n` +
          `Title: ${title}\n\nContent: ${body}`,
      },
    ],
  });

  const block = result.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Anthropic");
  return block.text;
}

interface FlashcardItem { question: string; answer: string }

async function generateFlashcards(
  title: string,
  content: string | null,
): Promise<FlashcardItem[]> {
  const body = content?.trim() || "(no content provided)";
  const result = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content:
          `Based on this study note, generate exactly 5 flashcards as JSON array.\n` +
          `Each flashcard has: question (string), answer (string).\n` +
          `Return only valid JSON, no markdown, no explanation.\n` +
          `Note title: ${title}\n` +
          `Note content: ${body}`,
      },
    ],
  });

  const block = result.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Anthropic");

  // Strip any accidental markdown fences before parsing
  const raw = block.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) throw new Error("Flashcard response is not an array");

  return parsed.map((item, i) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).question !== "string" ||
      typeof (item as Record<string, unknown>).answer !== "string"
    ) {
      throw new Error(`Flashcard at index ${i} has invalid shape`);
    }
    return { question: (item as FlashcardItem).question, answer: (item as FlashcardItem).answer };
  });
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

async function invalidateCache(userId: string, noteId: string): Promise<void> {
  try {
    await redis().del(
      `notes:single:${userId}:${noteId}`,
      `notes:list:${userId}`,
    );
  } catch {
    // Redis unavailable — the cache will expire naturally via TTL
  }
}

async function invalidateExamCache(userId: string, examId: string): Promise<void> {
  try {
    await redis().del(
      `exams:single:${userId}:${examId}`,
      `exams:list:${userId}`,
    );
  } catch {
    // Redis unavailable — the cache will expire naturally via TTL
  }
}

// ---------------------------------------------------------------------------
// AI helpers — exam predictions
// ---------------------------------------------------------------------------

interface PredictionItem {
  question: string;
  topic: string;
  likelihood: "high" | "medium" | "low";
  explanation: string;
  [key: string]: string;
}

async function generatePredictions(content: string): Promise<PredictionItem[]> {
  const result = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content:
          `You are an exam prediction expert. Analyze these past exam questions and predict the most likely questions for the next exam.\n\n` +
          `Past questions:\n${content}\n\n` +
          `Generate exactly 10 predicted questions as a JSON array.\n` +
          `Each item must have:\n` +
          `- question: string (the predicted exam question)\n` +
          `- topic: string (topic this question covers)\n` +
          `- likelihood: string (exactly one of: high, medium, low)\n` +
          `- explanation: string (why this question is likely to appear)\n\n` +
          `Return ONLY a valid JSON array. No markdown. No explanation. No code blocks. Just the raw JSON array.`,
      },
    ],
  });

  const block = result.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Anthropic");

  const raw = block.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) throw new Error("Predictions response is not an array");

  return parsed.map((item, i) => {
    const p = item as Record<string, unknown>;
    if (
      typeof p.question !== "string" ||
      typeof p.topic !== "string" ||
      typeof p.likelihood !== "string" ||
      typeof p.explanation !== "string"
    ) {
      throw new Error(`Prediction at index ${i} has invalid shape`);
    }
    const likelihood = p.likelihood as string;
    if (likelihood !== "high" && likelihood !== "medium" && likelihood !== "low") {
      throw new Error(`Prediction at index ${i} has invalid likelihood: ${likelihood}`);
    }
    return {
      question: p.question,
      topic: p.topic,
      likelihood: likelihood as "high" | "medium" | "low",
      explanation: p.explanation,
    };
  });
}

// ---------------------------------------------------------------------------
// AI helper — study plan generation
// ---------------------------------------------------------------------------

interface StudyPlanDayItem {
  study_date: string;
  title: string;
  description: string;
  note_ids: string[];
}

async function generateStudyPlan(
  subject: string,
  examDate: string,
  notesTitles: string[],
  daysUntilExam: number,
): Promise<StudyPlanDayItem[]> {
  const result = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content:
          `You are a study planning expert. Create a day-by-day study schedule for a student with an exam in ${daysUntilExam} days.\n\n` +
          `Subject: ${subject}\n` +
          `Available notes: ${notesTitles.join(", ")}\n` +
          `Exam date: ${examDate}\n\n` +
          `Create a study plan with one task per day.\n` +
          `Each day should have:\n` +
          `- A specific focus topic from the notes\n` +
          `- Clear study instructions\n` +
          `- Which note(s) to review (by title)\n\n` +
          `Rules:\n` +
          `- Last 3 days: review and practice only\n` +
          `- Space difficult topics early\n` +
          `- Include rest days for plans > 14 days\n` +
          `- Day before exam: light review only\n\n` +
          `Return ONLY a valid JSON array where each item has:\n` +
          `{\n` +
          `  "study_date": "YYYY-MM-DD",\n` +
          `  "title": "Day X: Topic Name",\n` +
          `  "description": "What to study and how",\n` +
          `  "note_titles": ["Note Title 1"]\n` +
          `}\n` +
          `Return exactly ${daysUntilExam} items. Dates start from today and go to the exam date.`,
      },
    ],
  });

  const block = result.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Anthropic");

  const raw = block.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Study plan response is not an array");

  return parsed.map((item, i) => {
    const it = item as Record<string, unknown>;
    if (typeof it.study_date !== "string" || typeof it.title !== "string" || typeof it.description !== "string") {
      throw new Error(`Study plan day at index ${i} has invalid shape`);
    }
    return {
      study_date:  it.study_date,
      title:       it.title,
      description: it.description,
      note_ids:    [],
    };
  });
}

// ---------------------------------------------------------------------------
// RabbitMQ connection with exponential-backoff retry
// ---------------------------------------------------------------------------

async function connectWithRetry() {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const connection = await createConnection();
      console.log("[rabbitmq] Connected");
      return connection;
    } catch (error) {
      const delay = Math.min(1_000 * 2 ** (attempt - 1), 30_000);
      console.error(
        `[rabbitmq] Connection attempt ${attempt} failed — retrying in ${delay}ms:`,
        (error as Error).message,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[worker] StudyHub worker starting...");

  const connection = await connectWithRetry();

  // One channel per queue for isolated prefetch windows
  const summarizeChannel      = await connection.createChannel();
  const flashcardsChannel     = await connection.createChannel();
  const examChannel           = await connection.createChannel();
  const groupSummarizeChannel = await connection.createChannel();
  const groupExamChannel      = await connection.createChannel();
  const studyPlanChannel      = await connection.createChannel();

  await summarizeChannel.assertQueue(SUMMARIZE_QUEUE,           { durable: true });
  await flashcardsChannel.assertQueue(FLASHCARDS_QUEUE,         { durable: true });
  await examChannel.assertQueue(EXAM_QUEUE,                     { durable: true });
  await groupSummarizeChannel.assertQueue(GROUP_SUMMARIZE_QUEUE, { durable: true });
  await groupExamChannel.assertQueue(GROUP_EXAM_QUEUE,           { durable: true });
  await studyPlanChannel.assertQueue(STUDY_PLAN_QUEUE,           { durable: true });

  summarizeChannel.prefetch(1);
  flashcardsChannel.prefetch(1);
  examChannel.prefetch(1);
  groupSummarizeChannel.prefetch(1);
  groupExamChannel.prefetch(1);
  studyPlanChannel.prefetch(1);

  connection.on("error", (err) => console.error("[rabbitmq] Connection error:", err));
  connection.on("close", () => {
    console.error("[rabbitmq] Connection closed unexpectedly — exiting for restart");
    process.exit(1);
  });

  // ---- Consumer: note.summarize -------------------------------------------

  console.log(`[worker] Consuming queue "${SUMMARIZE_QUEUE}"`);

  summarizeChannel.consume(SUMMARIZE_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: NoteSummarizePayload;
    try {
      payload = JSON.parse(msg.content.toString()) as NoteSummarizePayload;
    } catch {
      console.error("[summarize] Malformed message — discarding");
      summarizeChannel.nack(msg, false, false);
      return;
    }

    const { noteId, userId, title, content } = payload;
    console.log(`[summarize] Processing note ${noteId}`);

    try {
      const { allowed } = await checkWorkerLimit(userId, "ai_summaries");

      if (!allowed) {
        await supabase
          .from("study_notes")
          .update({ ai_summary: "Upgrade to Popular or Pro to unlock AI summaries." })
          .eq("id", noteId)
          .eq("user_id", userId);
        await invalidateCache(userId, noteId);
        summarizeChannel.ack(msg);
        console.log(`[summarize] Skipped note ${noteId} — user at summary limit`);
        return;
      }

      const summary = await generateSummary(title, content);

      const { error } = await supabase
        .from("study_notes")
        .update({ ai_summary: summary })
        .eq("id", noteId)
        .eq("user_id", userId);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);

      await incrementWorkerUsage(userId, "ai_summaries");
      await invalidateCache(userId, noteId);

      // Publish to flashcards queue now that we have the summary
      const flashcardsPayload: NoteFlashcardsPayload = {
        noteId,
        userId,
        title,
        content,
        summary,
      };
      summarizeChannel.sendToQueue(
        FLASHCARDS_QUEUE,
        Buffer.from(JSON.stringify(flashcardsPayload)),
        { persistent: true },
      );

      summarizeChannel.ack(msg);
      console.log(`[summarize] Done note ${noteId} — queued flashcard generation`);
    } catch (error) {
      console.error(`[summarize] Failed note ${noteId}:`, error);
      summarizeChannel.nack(msg, false, false);
    }
  });

  // ---- Consumer: note.flashcards ------------------------------------------

  console.log(`[worker] Consuming queue "${FLASHCARDS_QUEUE}"`);

  flashcardsChannel.consume(FLASHCARDS_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: NoteFlashcardsPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as NoteFlashcardsPayload;
    } catch {
      console.error("[flashcards] Malformed message — discarding");
      flashcardsChannel.nack(msg, false, false);
      return;
    }

    const { noteId, userId, title, content } = payload;
    console.log(`[flashcards] Generating flashcards for note ${noteId}`);

    try {
      const { allowed } = await checkWorkerLimit(userId, "flashcards");

      if (!allowed) {
        flashcardsChannel.ack(msg);
        console.log(`[flashcards] Skipped note ${noteId} — user at flashcard limit`);
        return;
      }

      const cards = await generateFlashcards(title, content);

      const rows = cards.map((card) => ({
        note_id:  noteId,
        user_id:  userId,
        question: card.question,
        answer:   card.answer,
      }));

      const { error } = await supabase.from("flashcards").insert(rows);
      if (error) throw new Error(`Supabase insert failed: ${error.message}`);

      await incrementWorkerUsage(userId, "flashcards");

      flashcardsChannel.ack(msg);
      console.log(`[flashcards] Inserted ${cards.length} flashcards for note ${noteId}`);
    } catch (error) {
      console.error(`[flashcards] Failed note ${noteId}:`, error);
      flashcardsChannel.nack(msg, false, false);
    }
  });

  // ---- Consumer: exam.predict ---------------------------------------------

  console.log(`[worker] Consuming queue "${EXAM_QUEUE}"`);

  examChannel.consume(EXAM_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: ExamPredictPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as ExamPredictPayload;
    } catch {
      console.error("[exam] Malformed message — discarding");
      examChannel.nack(msg, false, false);
      return;
    }

    const { examId, userId, content } = payload;
    console.log(`[exam] Generating predictions for exam ${examId}`);

    try {
      const predictions = await generatePredictions(content);

      const { error } = await supabase
        .from("exam_uploads")
        .update({ predictions: predictions as unknown as Json[], status: "ready", updated_at: new Date().toISOString() })
        .eq("id", examId)
        .eq("user_id", userId);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);

      await invalidateExamCache(userId, examId);

      examChannel.ack(msg);
      console.log(`[exam] Done exam ${examId} — inserted ${predictions.length} predictions`);
    } catch (error) {
      console.error(`[exam] Failed exam ${examId}:`, error);
      try {
        await supabase
          .from("exam_uploads")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", examId)
          .eq("user_id", userId);
      } catch { /* best-effort */ }
      examChannel.nack(msg, false, false);
    }
  });

  // ---- Consumer: group.note.summarize -------------------------------------

  console.log(`[worker] Consuming queue "${GROUP_SUMMARIZE_QUEUE}"`);

  groupSummarizeChannel.consume(GROUP_SUMMARIZE_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: GroupNoteSummarizePayload;
    try {
      payload = JSON.parse(msg.content.toString()) as GroupNoteSummarizePayload;
    } catch {
      console.error("[group-summarize] Malformed message — discarding");
      groupSummarizeChannel.nack(msg, false, false);
      return;
    }

    const { groupNoteId, title, content } = payload;
    console.log(`[group-summarize] Processing group note ${groupNoteId}`);

    try {
      const summary = await generateSummary(title, content);

      const { error } = await supabase
        .from("group_notes")
        .update({ ai_summary: summary })
        .eq("id", groupNoteId);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);

      groupSummarizeChannel.ack(msg);
      console.log(`[group-summarize] Done group note ${groupNoteId}`);
    } catch (error) {
      console.error(`[group-summarize] Failed group note ${groupNoteId}:`, error);
      groupSummarizeChannel.nack(msg, false, false);
    }
  });

  // ---- Consumer: group.exam.predict ---------------------------------------

  console.log(`[worker] Consuming queue "${GROUP_EXAM_QUEUE}"`);

  groupExamChannel.consume(GROUP_EXAM_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: GroupExamPredictPayload;
    try {
      payload = JSON.parse(msg.content.toString()) as GroupExamPredictPayload;
    } catch {
      console.error("[group-exam] Malformed message — discarding");
      groupExamChannel.nack(msg, false, false);
      return;
    }

    const { predictionId, combinedContent, papersCount } = payload;
    console.log(`[group-exam] Generating predictions for group prediction ${predictionId}`);

    try {
      const result = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3072,
        messages: [
          {
            role: "user",
            content:
              `You are an exam prediction expert. Analyze these ${papersCount} past exam papers from a study group and predict the most likely questions.\n\n` +
              `Combined past papers:\n${combinedContent}\n\n` +
              `Generate exactly 15 predicted questions as a JSON array.\n` +
              `Each item must have:\n` +
              `- question: string\n` +
              `- topic: string\n` +
              `- likelihood: string (high, medium, or low)\n` +
              `- explanation: string\n\n` +
              `Return ONLY valid JSON array. No markdown.`,
          },
        ],
      });

      const block = result.content[0];
      if (block.type !== "text") throw new Error("Non-text response from Anthropic");

      const raw = block.text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      const predictions = JSON.parse(raw) as unknown[];
      if (!Array.isArray(predictions)) throw new Error("Response is not an array");

      const { error } = await supabase
        .from("group_predictions")
        .update({ predictions: predictions as unknown as Json[], status: "ready" })
        .eq("id", predictionId);

      if (error) throw new Error(`Supabase update failed: ${error.message}`);

      groupExamChannel.ack(msg);
      console.log(`[group-exam] Done prediction ${predictionId} — ${predictions.length} predictions`);
    } catch (error) {
      console.error(`[group-exam] Failed prediction ${predictionId}:`, error);
      try {
        await supabase
          .from("group_predictions")
          .update({ status: "failed" })
          .eq("id", predictionId);
      } catch { /* best-effort */ }
      groupExamChannel.nack(msg, false, false);
    }
  });

  // ---- Consumer: study.plan.generate --------------------------------------

  console.log(`[worker] Consuming queue "${STUDY_PLAN_QUEUE}"`);

  studyPlanChannel.consume(STUDY_PLAN_QUEUE, async (msg) => {
    if (!msg) return;

    let payload: StudyPlanGeneratePayload;
    try {
      payload = JSON.parse(msg.content.toString()) as StudyPlanGeneratePayload;
    } catch {
      console.error("[study-plan] Malformed message — discarding");
      studyPlanChannel.nack(msg, false, false);
      return;
    }

    const { planId, userId, examDate, subject, noteIds, notesTitles, daysUntilExam } = payload;
    console.log(`[study-plan] Generating plan ${planId} — ${daysUntilExam} days`);

    try {
      const days = await generateStudyPlan(subject, examDate, notesTitles, daysUntilExam);

      // Build day rows — match note_ids by title position where possible
      const dayRows = days.map((day, idx) => ({
        plan_id:    planId,
        user_id:    userId,
        study_date: day.study_date,
        day_number: idx + 1,
        title:      day.title,
        description: day.description,
        note_ids:   noteIds.slice(0, 2),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from("study_plan_days")
        .insert(dayRows);

      if (insertError) throw new Error(`Insert days failed: ${insertError.message}`);

      // Create reminders at 8am for each day (reminders table has: user_id, title, remind_at)
      const reminders = dayRows.map((d) => ({
        user_id:   userId,
        title:     `Study: ${d.title}`,
        remind_at: `${d.study_date}T08:00:00Z`,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("reminders").insert(reminders);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("study_plans")
        .update({ status: "ready" })
        .eq("id", planId);

      if (updateError) throw new Error(`Update plan status failed: ${updateError.message}`);

      studyPlanChannel.ack(msg);
      console.log(`[study-plan] Done plan ${planId} — ${days.length} days inserted`);
    } catch (error) {
      console.error(`[study-plan] Failed plan ${planId}:`, error);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("study_plans").update({ status: "failed" }).eq("id", planId);
      } catch { /* best-effort */ }
      studyPlanChannel.nack(msg, false, false);
    }
  });

  // ---- Session reminder polling (every 60s) ---------------------------------
  async function checkSessionReminders() {
    try {
      const now = new Date();
      const in30 = new Date(now.getTime() + 31 * 60 * 1000).toISOString();
      const in1  = new Date(now.getTime() + 2  * 60 * 1000).toISOString();
      const ago5 = new Date(now.getTime() - 5  * 60 * 1000).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sessions } = await (supabase as any)
        .from("scheduled_sessions")
        .select("id, group_id, title, scheduled_at, status, day_notified, min30_notified, started_notified")
        .in("status", ["confirmed"])
        .gte("scheduled_at", ago5)
        .lte("scheduled_at", in30);

      for (const sess of (sessions ?? [])) {
        const scheduledAt = new Date(sess.scheduled_at);
        const msUntil = scheduledAt.getTime() - now.getTime();

        // Get group members
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: members } = await (supabase as any)
          .from("study_group_members").select("user_id").eq("group_id", sess.group_id);

        const makeNotifs = (msg: string, type: string) =>
          (members ?? []).map((m: { user_id: string }) => ({
            user_id: m.user_id, from_user_id: m.user_id,
            group_id: sess.group_id, type,
            message: msg,
          }));

        // Day-of notification (within 24h, not yet sent)
        if (!sess.day_notified && msUntil <= 24 * 60 * 60 * 1000 && msUntil > 31 * 60 * 1000) {
          const dateStr = scheduledAt.toLocaleString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("group_notifications").insert(
            makeNotifs(`📅 Reminder: "${sess.title}" live session is today at ${dateStr} WAT!`, "session_reminder_day")
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("scheduled_sessions").update({ day_notified: true }).eq("id", sess.id);
          console.log(`[reminders] Day notification sent for session ${sess.id}`);
        }

        // 30-min notification
        if (!sess.min30_notified && msUntil <= 31 * 60 * 1000 && msUntil > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("group_notifications").insert(
            makeNotifs(`⏰ "${sess.title}" live session starts in 30 minutes! Get ready.`, "session_reminder_30min")
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("scheduled_sessions").update({ min30_notified: true }).eq("id", sess.id);
          console.log(`[reminders] 30min notification sent for session ${sess.id}`);
        }

        // Session starting now (within 2 min window)
        if (!sess.started_notified && msUntil <= 2 * 60 * 1000 && msUntil > -5 * 60 * 1000) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("group_notifications").insert(
            makeNotifs(`🚀 "${sess.title}" live session is starting NOW! Join the Live tab.`, "session_started")
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("scheduled_sessions").update({ started_notified: true, status: "started" }).eq("id", sess.id);
          console.log(`[reminders] Start notification sent for session ${sess.id}`);
        }
      }
    } catch (e) {
      console.error("[reminders] Error checking session reminders:", e);
    }
  }

  // Run immediately then every 60 seconds
  void checkSessionReminders();
  const reminderInterval = setInterval(() => void checkSessionReminders(), 60 * 1000);

  // ---- Graceful shutdown ---------------------------------------------------

  const shutdown = async (signal: string) => {
    console.log(`\n[worker] ${signal} received — shutting down`);
    try { await summarizeChannel.close();      } catch { /* ignore */ }
    try { await flashcardsChannel.close();     } catch { /* ignore */ }
    try { await examChannel.close();           } catch { /* ignore */ }
    try { await groupSummarizeChannel.close(); } catch { /* ignore */ }
    try { await groupExamChannel.close();      } catch { /* ignore */ }
    try { await studyPlanChannel.close();      } catch { /* ignore */ }
    try { await connection.close();            } catch { /* ignore */ }
    clearInterval(reminderInterval);
    process.exit(0);
  };

  process.on("SIGINT",  () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
