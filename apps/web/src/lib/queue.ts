import { publishMessage } from "@studyhub/queue";
import type { NoteSummarizePayload, NoteFlashcardsPayload, ExamPredictPayload } from "@studyhub/queue";

export type { NoteSummarizePayload, NoteFlashcardsPayload, ExamPredictPayload };

export async function tryPublishNoteSummarize(payload: NoteSummarizePayload): Promise<void> {
  try {
    await publishMessage("note.summarize", payload);
  } catch (error) {
    console.error("[queue] Failed to publish note.summarize — RabbitMQ may be down:", error);
  }
}

export async function tryPublishNoteFlashcards(
  payload: Omit<NoteFlashcardsPayload, "summary">,
): Promise<void> {
  try {
    await publishMessage("note.flashcards", payload);
  } catch (error) {
    console.error("[queue] Failed to publish note.flashcards — RabbitMQ may be down:", error);
  }
}

export async function tryPublishExamPredict(payload: ExamPredictPayload): Promise<void> {
  try {
    await publishMessage("exam.predict", payload);
  } catch (error) {
    console.error("[queue] Failed to publish exam.predict — RabbitMQ may be down:", error);
  }
}
