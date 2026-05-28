import Link from "next/link";
import { BookOpen, ExternalLink, Globe, Mail } from "lucide-react";

const LINKS = {
  Product: [
    { label: "Features",     href: "/#features" },
    { label: "Pricing",      href: "/pricing" },
    { label: "How It Works", href: "/#how-it-works" },
  ],
  Resources: [
    { label: "Blog",         href: "#" },
    { label: "Support",      href: "mailto:support@studyhubai.xyz" },
    { label: "Status",       href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Contact",        href: "mailto:support@studyhubai.xyz" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-[#286A63]/50 bg-[#071A18] px-6 pb-8 pt-16">
      <div className="mx-auto max-w-6xl">
        {/* Columns */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#14B8A7]" />
              <span className="text-lg font-bold text-[#14B8A7]">StudyHub</span>
            </Link>
            <p className="text-sm leading-relaxed text-[#95A3A1]">
              Study smarter with AI-powered notes, flashcards, and exam predictions.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {[
                { Icon: Globe,         label: "Website" },
                { Icon: Mail,          label: "Email" },
                { Icon: ExternalLink,  label: "LinkedIn" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#286A63]/50 text-[#95A3A1] transition-colors duration-200 hover:border-[#14B8A7]/50 hover:text-[#14B8A7]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {(Object.entries(LINKS) as [string, readonly { label: string; href: string }[]][]).map(
            ([heading, links]) => (
              <div key={heading}>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#14B8A7]">
                  {heading}
                </p>
                <ul className="space-y-2.5">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-sm text-[#95A3A1] transition-colors duration-200 hover:text-[#14B8A7]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#286A63]/30 pt-6 text-xs text-[#4A6B67] sm:flex-row">
          <span>© {new Date().getFullYear()} StudyHub. All rights reserved.</span>
          <span>Made for African students 🌍</span>
          <span>Powered by AI</span>
        </div>
      </div>
    </footer>
  );
}
