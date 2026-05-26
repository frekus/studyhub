export type QueueMessage<T = unknown> = {
  id: string;
  type: string;
  payload: T;
  createdAt: string;
};

export type NoteSummarizePayload = {
  noteId: string;
  userId: string;
  title: string;
  content: string | null;
};

export type NoteFlashcardsPayload = {
  noteId: string;
  userId: string;
  title: string;
  content: string | null;
  summary: string;
};

export type ExamPredictPayload = {
  examId: string;
  userId: string;
  title: string;
  content: string;
};

export type GroupNoteSummarizePayload = {
  groupNoteId: string;
  groupId: string;
  title: string;
  content: string | null;
};

export type GroupExamPredictPayload = {
  predictionId: string;
  groupId: string;
  combinedContent: string;
  papersCount: number;
  membersCount: number;
};

export type StudyPlanGeneratePayload = {
  planId: string;
  userId: string;
  examDate: string;
  subject: string;
  noteIds: string[];
  notesTitles: string[];
  daysUntilExam: number;
};
