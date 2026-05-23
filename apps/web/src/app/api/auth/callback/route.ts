// Requires Google OAuth configured in Supabase Dashboard:
//   Authentication → Providers → Google → Enable
//   Add your Google Client ID and Secret from Google Cloud Console
//   Authorized redirect URI: https://your-project.supabase.co/auth/v1/callback

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return Response.redirect(`${appUrl}/login?error=callback_failed`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return Response.redirect(`${appUrl}/login?error=callback_failed`);
  }

  const user = data.user;

  // Upsert the public profile — safe to call on every OAuth sign-in
  // because the user may have signed in before (do nothing on conflict).
  const { error: profileError } = await supabase
    .from("users")
    .upsert(
      {
        id:         user.id,
        full_name:  user.user_metadata?.full_name as string | null ?? null,
        avatar_url: user.user_metadata?.avatar_url as string | null ?? null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

  if (profileError) {
    return Response.redirect(`${appUrl}/login?error=callback_failed`);
  }

  return Response.redirect(`${appUrl}/dashboard`);
}
