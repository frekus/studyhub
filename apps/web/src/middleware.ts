import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public routes — never redirected to /login even when unauthenticated:
//   /api/auth/google   — initiates the Google OAuth flow
//   /api/auth/callback — handles the OAuth code exchange from Supabase
//
// These are already outside the matcher below, but listed here for clarity.

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // For /admin routes, verify the user is still an active admin.
  if (user && pathname.startsWith("/admin")) {
    try {
      const { data: userRow } = await supabase
        .from("users")
        .select("is_admin, admin_expires_at")
        .eq("id", user.id)
        .maybeSingle();

      const isExpired = userRow?.admin_expires_at
        ? new Date(userRow.admin_expires_at as string) < new Date()
        : false;

      if (!userRow?.is_admin || isExpired) {
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    } catch {
      // If the column doesn't exist yet (migration pending), fall through —
      // the API-level requireAdmin check will still enforce access.
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
