"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";

interface ReferralStats { totalCodes:number; totalSignups:number; totalSubscribed:number; totalRewarded:number; }
interface ReferralRow { id:string; code:string; referrer_name:string; created_at:string; total_signups:number; total_subscribed:number; total_rewarded:number; }

export default function ReferralsReportPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/referrals")
      .then(r => { if (r.status === 403) { router.replace("/dashboard"); return null; } return r.json(); })
      .then(j => { if (j?.data) { setStats(j.data.stats); setReferrals(j.data.referrals); } })
      .catch(() => setError("Failed to load referral data"))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#040D0B] text-white">
      <header className="sticky top-0 z-40 border-b border-[#1a3330] bg-[#040D0B]/95 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 text-sm text-[#6b8f88] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Link>
          <h1 className="text-lg font-bold text-white">Referral Programme Report</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {([
                  ["Total Codes", stats.totalCodes, "teal"],
                  ["Total Sign-ups", stats.totalSignups, "blue"],
                  ["Subscribed", stats.totalSubscribed, "green"],
                  ["Rewards Granted", stats.totalRewarded, "orange"],
                ] as [string, number, string][]).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#1a3330] bg-[#071A18] p-5">
                    <p className="text-3xl font-bold text-white">{value}</p>
                    <p className="text-sm text-[#6b8f88] mt-1">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-[#1a3330] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a3330] bg-[#071A18]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Code</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Sign-ups</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Subscribed</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Rewards</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#6b8f88] uppercase tracking-wide">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-[#6b8f88]">
                          No referrals yet. Share your referral link to get started.
                        </td>
                      </tr>
                    ) : (
                      [...referrals]
                        .sort((a, b) => b.total_subscribed - a.total_subscribed)
                        .map((r, i) => (
                          <tr key={r.id} className="border-b border-[#1a3330] hover:bg-[#0a2420] transition-colors">
                            <td className="px-4 py-3 text-center text-lg">
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[#6b8f88] text-sm">{i + 1}</span>}
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{r.referrer_name}</td>
                            <td className="px-4 py-3 font-mono text-sm text-teal-400 font-bold tracking-widest">{r.code}</td>
                            <td className="px-4 py-3 text-center text-white">{r.total_signups}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={r.total_subscribed >= 10 ? "text-green-400 font-bold" : "text-white"}>
                                {r.total_subscribed}
                                {r.total_subscribed > 0 && (
                                  <span className="ml-1 text-xs text-[#6b8f88]">/ 10</span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {r.total_rewarded > 0
                                ? <span className="text-orange-400 font-semibold">{r.total_rewarded} 🎁</span>
                                : <span className="text-[#6b8f88]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#6b8f88]">
                              {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
