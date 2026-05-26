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

  // For /admin routes, verify the user has a valid row in admin_users.
  if (user && pathname.startsWith("/admin")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("admin_users")
        .select("role, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // Only redirect if we can positively confirm the user is not an admin.
      // If data is null (RLS blocking the read or no row), fall through —
      // the page's own /api/admin/check will handle verification.
      if (data) {
        const isExpired = data.expires_at
          ? new Date(data.expires_at as string) < new Date()
          : false;

        if (!data.role || isExpired) {
          const dashboardUrl = request.nextUrl.clone();
          dashboardUrl.pathname = "/dashboard";
          return NextResponse.redirect(dashboardUrl);
        }
      }
    } catch {
      // Non-fatal — fall through to the page-level check.
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
