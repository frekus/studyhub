// Requires Google OAuth configured in Supabase Dashboard:
//   Authentication → Providers → Google → Enable
//   Add your Google Client ID and Secret from Google Cloud Console
//   Authorized redirect URI: https://your-project.supabase.co/auth/v1/callback

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`,
    );
  }

  return Response.redirect(data.url);
}
