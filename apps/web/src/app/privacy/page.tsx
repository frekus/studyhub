import Link from "next/link";

export const metadata = { title: "Privacy Policy | StudyHub AI" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-sm text-accent hover:underline">← Back to StudyHub</Link>
          <h1 className="mt-6 text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: May 2026</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">

          <section>
            <p className="text-muted-foreground leading-relaxed">
              StudyHub AI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your personal data.
              This Privacy Policy explains what data we collect, how we use it, and your rights under the
              Nigeria Data Protection Act (NDPA) 2023 and the General Data Protection Regulation (GDPR)
              where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Data We Collect</h2>
            <div className="space-y-3 text-muted-foreground">
              <p><strong className="text-foreground">Account Data:</strong> Your name and email address when you sign up.</p>
              <p><strong className="text-foreground">Study Content:</strong> Notes, flashcards, and study plans you create on the platform.</p>
              <p><strong className="text-foreground">Exam Materials:</strong> PDF documents and exam papers you upload to study groups.</p>
              <p><strong className="text-foreground">Usage Data:</strong> Study streaks, flashcard performance, AI conversation history, and activity patterns used to personalise your experience.</p>
              <p><strong className="text-foreground">Payment Data:</strong> Subscription status and billing cycle. We do not store card details — all payments are processed securely by Paystack.</p>
              <p><strong className="text-foreground">Device Data:</strong> IP address, browser type, and device information for security purposes.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Data</h2>
            <div className="space-y-2 text-muted-foreground">
              <p>• To provide and improve the StudyHub AI service</p>
              <p>• To personalise your AI study companion based on your subjects and performance</p>
              <p>• To process subscription payments via Paystack</p>
              <p>• To send important account notifications (security alerts, billing)</p>
              <p>• To detect and prevent fraud and abuse</p>
              <p>• To comply with legal obligations under NDPA 2023</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Storage & Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely on Supabase (PostgreSQL) with encryption at rest and in transit.
              We use Row Level Security (RLS) to ensure you can only access your own data.
              All connections are encrypted via TLS/SSL. We never sell your data to third parties or
              use it for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. AI & Data Processing</h2>
            <p className="text-muted-foreground leading-relaxed">
              StudyHub AI uses Anthropic&apos;s Claude AI model to generate note summaries, flashcards,
              and exam predictions. Your study content is sent to Anthropic&apos;s API for processing.
              Anthropic&apos;s privacy policy applies to this processing.
              We do not use your content to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your Rights (NDPA 2023 & GDPR)</h2>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Right to Access:</strong> Request a copy of all data we hold about you.</p>
              <p><strong className="text-foreground">Right to Deletion:</strong> Delete your account and all associated data from your account settings at any time.</p>
              <p><strong className="text-foreground">Right to Correction:</strong> Update your personal information in your account settings.</p>
              <p><strong className="text-foreground">Right to Object:</strong> Object to processing of your data for any purpose.</p>
              <p><strong className="text-foreground">Right to Portability:</strong> Request an export of your study notes and data.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. If you delete your account,
              all your personal data is permanently deleted within 24 hours. Anonymised, aggregated
              usage statistics may be retained for service improvement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
            <div className="space-y-2 text-muted-foreground">
              <p><strong className="text-foreground">Paystack:</strong> Payment processing. Subject to Paystack&apos;s privacy policy.</p>
              <p><strong className="text-foreground">Anthropic:</strong> AI model provider. Subject to Anthropic&apos;s privacy policy.</p>
              <p><strong className="text-foreground">Supabase:</strong> Database and authentication. Subject to Supabase&apos;s privacy policy.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies only — specifically Supabase authentication session cookies
              required for you to stay logged in. We do not use tracking, advertising, or
              analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              StudyHub AI is intended for university students aged 16 and above.
              We do not knowingly collect data from children under 16.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy from time to time. We will notify you of significant changes
              via email or an in-app notification. Continued use of StudyHub AI after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any privacy-related requests or questions, contact us at:<br />
              <strong className="text-foreground">privacy@studyhubai.xyz</strong><br /><br />
              For data deletion requests, you can also use the Delete Account feature in your
              account settings, which takes effect immediately.
            </p>
          </section>

        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>StudyHub AI · studyhubai.xyz · Nigeria</p>
          <p className="mt-1">Compliant with Nigeria Data Protection Act (NDPA) 2023</p>
        </div>
      </div>
    </div>
  );
}
