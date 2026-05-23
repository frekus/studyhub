import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

/**
 * Service-role client — bypasses RLS.
 * Only for trusted server-side processes (workers, migrations).
 * Never expose the service role key to the browser or anon clients.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
