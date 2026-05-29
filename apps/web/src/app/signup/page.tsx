"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Brain, Zap, TrendingUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [refCode, setRefCode] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setRefCode(ref.toUpperCase());
  }, [searchParams]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password strength
  function getStrength(pw: string): { score: number; label: string; color: string; checks: Record<string, boolean> } {
    const checks = {
      length:    pw.length >= 8,
      uppercase: /[A-Z]/.test(pw),
      number:    /[0-9]/.test(pw),
      special:   /[^A-Za-z0-9]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const label = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
    const color = score <= 1 ? "bg-red-500" : score === 2 ? "bg-amber-500" : score === 3 ? "bg-blue-500" : "bg-green-500";
    return { score, label, color, checks };
  }
  const strength = getStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Client-side password validation
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least one number."); return; }
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Signup failed");
        return;
      }

      // Redeem referral code if provided
      if (refCode.trim()) {
        await fetch("/api/referral/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: refCode.trim() }),
        }).catch(() => {}); // Non-fatal
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#071A18] p-10 lg:flex lg:w-5/12">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-400" />
            <span className="text-xl font-bold text-orange-400">StudyHub</span>
          </Link>
        </div>
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight text-white">
              Start studying<br />smarter today
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#95A3A1]">
              Create your free account and unlock AI-powered tools that help you learn faster and remember more.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: Brain, text: "AI summaries in seconds" },
              { icon: Zap, text: "Auto-generated flashcards" },
              { icon: TrendingUp, text: "Exam question predictions" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[#95A3A1]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-400/10">
                  <Icon className="h-4 w-4 text-orange-400" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#4A6B67]">© {new Date().getFullYear()} StudyHub</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-400" />
              <span className="text-xl font-bold text-orange-400">StudyHub</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Free forever — no credit card required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1,2,3,4].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.score ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${
                      strength.score <= 1 ? "text-red-500" :
                      strength.score === 2 ? "text-amber-500" :
                      strength.score === 3 ? "text-blue-500" : "text-green-500"
                    }`}>{strength.label}</span>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className={strength.checks.length    ? "text-green-500" : ""}>8+ chars</span>
                      <span className={strength.checks.uppercase ? "text-green-500" : ""}>A-Z</span>
                      <span className={strength.checks.number    ? "text-green-500" : ""}>0-9</span>
                      <span className={strength.checks.special   ? "text-green-500" : ""}>!@#</span>
                    </div>
                  </div>
                </div>
              )}
            {/* Referral code field */}
            <div className="space-y-2">
              <Label htmlFor="refCode">
                Referral code{" "}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="refCode"
                type="text"
                placeholder="e.g. ABCD1234"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-mono tracking-widest uppercase"
                autoComplete="off"
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create free account"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={() => { window.location.href = "/api/auth/google"; }}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-orange-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
