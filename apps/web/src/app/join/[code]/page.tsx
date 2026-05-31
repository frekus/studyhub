"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { BookOpen, Loader2, Users, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

export default function JoinGroupPage() {
  const router  = useRouter();
  const params  = useParams();
  const code    = params?.code as string;

  const [status, setStatus]   = useState<"loading" | "joining" | "success" | "error" | "auth">("loading");
  const [message, setMessage] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (!code) return;
    // Check if user is logged in
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(async (data: { data?: { user?: { id?: string } } }) => {
        if (!data?.data?.user?.id) {
          // Not logged in — redirect to login with return URL
          router.replace(`/login?redirect=/join/${code}`);
          return;
        }
        // Logged in — attempt to join
        setStatus("joining");
        const res = await fetch(`/api/groups/join/${code}`, { method: "POST", credentials: "include" });
        const json = await res.json() as { data?: { group?: { name: string }; message?: string }; error?: string };
        if (res.ok) {
          setGroupName(json.data?.group?.name ?? "the group");
          setStatus("success");
          setTimeout(() => router.replace("/dashboard?tab=groups"), 2000);
        } else {
          setMessage(json.error ?? "Failed to join group");
          setStatus("error");
        }
      })
      .catch(() => { setMessage("Network error"); setStatus("error"); });
  }, [code, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <BookOpen className="h-5 w-5 text-orange-400" />
          <span className="text-lg font-bold text-orange-400">StudyHub</span>
        </Link>

        {(status === "loading" || status === "joining") && (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mx-auto">
              <Loader2 className="h-7 w-7 animate-spin text-accent" />
            </div>
            <p className="font-semibold">
              {status === "loading" ? "Checking your account…" : "Joining group…"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Just a moment</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 mx-auto">
              <CheckCircle className="h-7 w-7 text-green-500" />
            </div>
            <p className="font-semibold">You joined {groupName}!</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to your groups…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mx-auto">
              <XCircle className="h-7 w-7 text-destructive" />
            </div>
            <p className="font-semibold">Couldn't join group</p>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Link
              href="/dashboard?tab=groups"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Go to Groups
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
