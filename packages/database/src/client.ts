import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export function createClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }

  return createSupabaseClient<Database>(url, key);
}
