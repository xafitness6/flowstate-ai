import type { Metadata } from "next";
import { LegalShell, Section, P, Bullet, Row } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy — Flowstate AI",
  description: "How Flowstate AI collects, uses, shares, and protects your information.",
};

const EFFECTIVE_DATE = "June 10, 2026";

/**
 * Project-specific privacy policy. Not lawyer-reviewed. Reflects what the
 * code actually does today — third-party processors, what's stored where,
 * data retention, user rights. Update the EFFECTIVE_DATE above whenever
 * a material change ships.
 */
export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy"
      effective={EFFECTIVE_DATE}
      intro="This explains what Flowstate AI collects, what we use it for, who we share it with, how long we keep it, and how you control it. We aim for plain English; the legal-sounding bits exist where they have to."
    >
      <Section title="Who we are">
        <P>
          Flowstate AI (&quot;Flowstate&quot;, &quot;we&quot;, &quot;us&quot;) is a fitness coaching app. We provide
          training programs, nutrition guidance, AI conversations, and a place to log workouts,
          meals, and progress. We are the controller of the personal data described below.
        </P>
        <P>
          Contact for any privacy question:{" "}
          <a href="mailto:xavellis4@gmail.com" className="text-[#B48B40] hover:underline">xavellis4@gmail.com</a>.
        </P>
      </Section>

      <Section title="What we collect">
        <P>We collect what we need to coach you, no more. Categories:</P>
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>
            <strong className="text-white/85">Account</strong> — name, email, role (member, client, trainer, master), plan tier,
            and optional phone. Created when you sign up.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Onboarding intake</strong> — what you tell us about your training history, equipment,
            injuries, dietary style, sleep, stress, and goals. Used to build your program and to brief the AI coach.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Body data</strong> — height, weight, sex at birth, age, body-fat % if shared.
            Used for BMR / TDEE / macro calculations and weight-trend reads.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Activity logs</strong> — workout logs, set/rep/load history, RPE,
            meal logs, hydration, daily check-ins. Used to render your dashboard and progress.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">AI conversations</strong> — what you ask the coach and the coach&apos;s replies.
            Stored so you can read the thread later and so the coach has memory.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Progress photos</strong> — optional. Stored in a private bucket; only delivered
            to you (and your assigned trainer, if any) via short-lived signed URLs.
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Payment</strong> — Stripe handles your card directly. We only see the masked
            details Stripe returns (last 4, brand, customer id, subscription status).
          </Bullet>
          <Bullet>
            <strong className="text-white/85">Device + session</strong> — browser type, IP, and authentication tokens stored as
            cookies for sign-in. We use localStorage for non-sensitive UI state (theme, picker positions, last-active role).
          </Bullet>
        </ul>
      </Section>

      <Section title="What we use it for">
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>Run your account, your program, your nutrition plan, and your coach.</Bullet>
          <Bullet>Generate AI coaching responses tailored to your intake and recent activity.</Bullet>
          <Bullet>Bill you and process subscription changes through Stripe.</Bullet>
          <Bullet>Send transactional email (sign-in links, password reset, important account notices).</Bullet>
          <Bullet>Maintain platform safety — rate limits, abuse detection, error monitoring.</Bullet>
          <Bullet>Improve the app. We never sell your data. We never share with advertisers.</Bullet>
        </ul>
      </Section>

      <Section title="Who we share it with">
        <P>
          We only share with the processors required to run the service. Each one is bound by their
          own terms; we do not give them rights to use your data for anything beyond running our service for you.
        </P>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-2 divide-y divide-white/[0.05]">
          <Row label="Supabase">Database, authentication, and file storage. Hosts your account, logs, intake, conversations, and progress photos.</Row>
          <Row label="OpenAI">AI coaching responses (gpt-4o), TTS for the in-chat voice (gpt-4o-mini-tts), and image generation for meal-plan dish photos and product imagery (gpt-image-1). Your prompts and recent context are sent to OpenAI to produce responses. Per OpenAI&apos;s API terms, these are not used to train their models.</Row>
          <Row label="Stripe">Payment processing and subscription management. Handles your card directly; we do not store full card numbers.</Row>
          <Row label="Resend">Sends transactional email (sign-in links, password reset, important account notices).</Row>
          <Row label="Higgsfield AI">Optional only. Used to render a short talking-head video from a coach reply when Pro is enabled. Disabled on free accounts.</Row>
          <Row label="USDA FoodData Central">Public food-data lookups during meal logging. No personal data is sent.</Row>
          <Row label="Vercel">Hosts and serves the app.</Row>
        </div>
        <P>
          We may also share information when required by valid legal process, to protect the rights, property, or safety of
          users or the public, or as part of a corporate transaction (merger, acquisition, financing). If that ever happens,
          we will notify you and the new owner will be bound by terms at least as protective as these.
        </P>
      </Section>

      <Section title="AI disclosure">
        <P>
          Several parts of Flowstate use AI — the coach chat, the form-check feature, the meal parser, the nutrition planner,
          and image generation. AI responses are generated, not authored by a human, and may be wrong. They are not medical,
          legal, or financial advice. See the <a href="/disclaimer" className="text-[#B48B40] hover:underline">Disclaimer</a> page
          for the full scope and your responsibilities when acting on AI output.
        </P>
      </Section>

      <Section title="Children">
        <P>
          Flowstate is not directed at children under 13. If you are a parent and believe your child has signed up,
          email us and we will delete the account.
        </P>
      </Section>

      <Section title="How long we keep it">
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>Account, intake, and activity logs: for as long as your account is active.</Bullet>
          <Bullet>Closed accounts: we retain a minimal record (email, account creation date, subscription history) for up to 24 months for fraud and tax compliance, then delete.</Bullet>
          <Bullet>AI conversation history: stored with your account; deleted with it.</Bullet>
          <Bullet>Progress photos: stored only while your account exists; deleted on account deletion.</Bullet>
          <Bullet>Stripe records: governed by Stripe&apos;s retention; we hold a read-only copy of subscription state.</Bullet>
          <Bullet>Server logs: scrubbed of identifiers and retained for up to 30 days for operational debugging.</Bullet>
        </ul>
      </Section>

      <Section title="Your rights">
        <P>
          You can — at any time, from your account or by emailing us:
        </P>
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>See what we have about you.</Bullet>
          <Bullet>Correct anything that&apos;s wrong.</Bullet>
          <Bullet>Export a copy of your data.</Bullet>
          <Bullet>Delete your account and the data tied to it.</Bullet>
          <Bullet>Cancel your subscription. Cancellation takes effect at the end of the current billing period.</Bullet>
          <Bullet>Withdraw consent for optional features (e.g. the coach avatar video) without losing the rest of the service.</Bullet>
        </ul>
        <P>
          California residents (CCPA / CPRA) and EU/UK residents (GDPR) have additional rights including the right to
          opt out of profiling, the right to object to processing, and the right to lodge a complaint with a supervisory
          authority. Email us and we will honor them.
        </P>
      </Section>

      <Section title="How we protect it">
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>Transport is encrypted (TLS). Data at rest in Supabase is encrypted on disk.</Bullet>
          <Bullet>Authentication uses Supabase Auth with secure HttpOnly cookies. Passwords are hashed by Supabase, never stored in plaintext.</Bullet>
          <Bullet>Row-level security policies prevent users from reading each other&apos;s data.</Bullet>
          <Bullet>Server routes are gated by authentication and rate-limited. AI inputs are sanitized to limit injection.</Bullet>
          <Bullet>Server logs are scrubbed of email, phone, and IDs before being persisted.</Bullet>
          <Bullet>If we ever experience a breach of personal data, we will notify affected users without undue delay.</Bullet>
        </ul>
      </Section>

      <Section title="International transfers">
        <P>
          Our processors (Supabase, OpenAI, Stripe, Resend, Vercel) operate from the United States. If you are
          outside the U.S., your data will be transferred to the U.S. for processing. By using Flowstate, you consent
          to this transfer.
        </P>
      </Section>

      <Section title="Changes to this policy">
        <P>
          We will post material changes here and update the effective date. For significant changes affecting how
          we use your data, we will also notify you by email or in-app at least 30 days before the change takes effect.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions, requests, or privacy concerns:{" "}
          <a href="mailto:xavellis4@gmail.com" className="text-[#B48B40] hover:underline">xavellis4@gmail.com</a>.
          We aim to respond within 5 business days.
        </P>
      </Section>
    </LegalShell>
  );
}
