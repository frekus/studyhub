import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@studyhub/database";
import { err } from "@/lib/response";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — cookie writes are a no-op.
          // Middleware is responsible for refreshing the session in that case.
        }
      },
    },
  });
}

type Client = Awaited<ReturnType<typeof createClient>>;

type AuthSuccess = { user: NonNullable<Awaited<ReturnType<Client["auth"]["getUser"]>>["data"]["user"]>; authErr: null };
type AuthFailure = { user: null; authErr: ReturnType<typeof err> };

export async function requireUser(supabase: Client): Promise<AuthSuccess | AuthFailure> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, authErr: err("Unauthorized", 401) };
  return { user, authErr: null };
}
