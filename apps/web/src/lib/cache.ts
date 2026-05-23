import { redis } from "@studyhub/cache";

export const NOTE_TTL = 300; // 5 minutes
export const EXAM_TTL = 300; // 5 minutes

export const cacheKeys = {
  notesList:   (userId: string) => `notes:list:${userId}`,
  noteSingle:  (userId: string, noteId: string) => `notes:single:${userId}:${noteId}`,
  examsList:   (userId: string) => `exams:list:${userId}`,
  examSingle:  (userId: string, examId: string) => `exams:single:${userId}:${examId}`,
};

/**
 * Returns parsed JSON from Redis, or null on miss or any error.
 * Never throws — Redis failures are silent so the caller falls through to Supabase.
 */
export async function tryGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Serialises value to JSON and stores it with an EX TTL.
 * Silently no-ops on any Redis error.
 */
export async function trySet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Redis unavailable — fall through
  }
}

/**
 * Deletes one or more keys atomically.
 * Silently no-ops on any Redis error.
 */
export async function tryDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis().del(...keys as [string, ...string[]]);
  } catch {
    // Redis unavailable — fall through
  }
}
