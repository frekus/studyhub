"use client";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AvatarDropdown } from "@/components/avatar-dropdown";
interface Props {
  isLoggedIn: boolean;
  userEmail: string;
  currentPlan?: string;
  avatarUrl?: string | null;
}
export function SiteHeader({ isLoggedIn, userEmail, currentPlan, avatarUrl }: Props) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-400" />
          <span className="text-xl font-bold text-orange-400">StudyHub</span>
        </Link>
        {/* Centre links */}
        <div className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="/#features"    className="text-muted-foreground transition-colors hover:text-foreground">Features</a>
          <a href="/#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a>
          <Link href="/pricing"   className="text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isLoggedIn ? (
            <AvatarDropdown email={userEmail} plan={currentPlan} avatarUrl={avatarUrl} />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get started free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
