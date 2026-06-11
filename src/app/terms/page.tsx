import type { Metadata } from "next";
import { LegalShell, Section, P, Bullet } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms — Flowstate AI",
  description: "Terms of Service for Flowstate AI.",
};

const EFFECTIVE_DATE = "June 10, 2026";

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms"
      effective={EFFECTIVE_DATE}
      intro="These are the rules of using Flowstate AI. By creating an account or paying for a subscription, you agree to them."
    >
      <Section title="Who can use Flowstate">
        <P>
          You must be at least 13 years old (in the U.S.) or 16 (EU/UK), be in good general health, and use the service
          for personal training and nutrition. If you have a medical condition or are pregnant, talk to a qualified
          medical provider before starting any plan you see in Flowstate.
        </P>
      </Section>

      <Section title="Your account">
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>Use real, accurate information when you sign up.</Bullet>
          <Bullet>Keep your password and devices secure. You&apos;re responsible for activity on your account.</Bullet>
          <Bullet>Don&apos;t share your account. One person per account.</Bullet>
          <Bullet>If your account is paid for by a trainer or organization, the holder of the billing relationship may end your access.</Bullet>
        </ul>
      </Section>

      <Section title="What you can and can't do">
        <P>You can use Flowstate to train, eat, recover, and improve. You can&apos;t:</P>
        <ul className="space-y-2 pl-0 list-none">
          <Bullet>Scrape, reverse-engineer, or copy any part of the service.</Bullet>
          <Bullet>Resell access, package the AI output as a competing product, or use it to train models.</Bullet>
          <Bullet>Try to bypass rate limits, authentication, or security.</Bullet>
          <Bullet>Send prompts that target other users, attempt to extract our system prompts, or attempt to get the AI to act outside fitness coaching.</Bullet>
          <Bullet>Upload anything you don&apos;t have the right to upload (images of other people without consent, copyrighted material, etc.).</Bullet>
        </ul>
        <P>
          We may suspend or close accounts that violate these rules, especially if other users could be harmed.
        </P>
      </Section>

      <Section title="AI output is not advice">
        <P>
          The AI coach, form-check, meal planner, and any other AI feature are software. Their output is generated, can be
          wrong, and is not medical, dietary, legal, or financial advice. Apply judgment. If something feels off — pain,
          dizziness, a dramatic change in mood, energy, or appetite — see a qualified professional. See the{" "}
          <a href="/disclaimer" className="text-[#B48B40] hover:underline">Disclaimer</a> for the full read.
        </P>
      </Section>

      <Section title="Subscription, billing, and cancellation">
        <P>
          Paid plans are billed monthly or annually, in advance. Your subscription auto-renews at the end of each billing
          period at the then-current rate. You may cancel any time from{" "}
          <a href="/settings/billing" className="text-[#B48B40] hover:underline">Settings → Billing</a>{" "}
          or by emailing us — cancellation takes effect at the end of your current billing period and you keep access
          until then. We don&apos;t prorate partial periods.
        </P>
        <P>
          We may change pricing for future billing periods. We will notify you at least 30 days before the change takes
          effect and you can cancel before it does. Taxes may apply based on your location.
        </P>
        <P>
          <strong className="text-white/85">Refunds.</strong> Subscription fees are non-refundable except where required
          by law. If you believe you were billed in error, email us within 30 days and we will look into it.
        </P>
      </Section>

      <Section title="Trainer / coach relationships">
        <P>
          Flowstate connects clients to trainers. Trainers operating on the platform are independent — they are not
          employees of Flowstate, and we do not supervise or guarantee their advice. The trainer-client relationship
          is between you and the trainer. We provide the tools.
        </P>
      </Section>

      <Section title="Your content">
        <P>
          You own what you put into Flowstate — your logs, your messages, your photos. By using the service, you grant
          us a limited license to host, process, display, and transmit your content as needed to run the service for you.
          That license ends when you delete the content or your account.
        </P>
      </Section>

      <Section title="Our content">
        <P>
          The app, the brand, the design, the source code, and the program library are ours (or licensed to us). You don&apos;t
          get to copy, repackage, or sell them. AI outputs generated for you are yours to use for personal training; you
          can&apos;t republish them as a service.
        </P>
      </Section>

      <Section title="Service availability">
        <P>
          We aim for high uptime but can&apos;t promise the service will be uninterrupted or error-free. We may take parts
          of the service down for maintenance, security, or to ship new features. Major planned outages will be announced
          in advance when feasible.
        </P>
      </Section>

      <Section title="Disclaimers and liability">
        <P>
          To the maximum extent permitted by law, the service is provided &quot;as is&quot;. We disclaim warranties of
          fitness for a particular purpose, merchantability, and non-infringement. We are not liable for indirect,
          incidental, special, or consequential damages arising from your use of the service. Our total liability for any
          claim is limited to the amount you paid us in the 12 months before the claim arose.
        </P>
        <P>
          Nothing here limits liability that cannot be limited under applicable law (including gross negligence and
          willful misconduct).
        </P>
      </Section>

      <Section title="Termination">
        <P>
          You can close your account at any time from settings or by emailing us. We can suspend or terminate accounts that
          violate these terms. On termination, the &quot;Your content&quot;, &quot;Disclaimers&quot;, and &quot;Liability&quot; sections survive.
        </P>
      </Section>

      <Section title="Governing law">
        <P>
          These terms are governed by the laws of the state where the operator of Flowstate AI is established, without
          regard to conflict-of-law rules. Mandatory consumer-protection rules of your country of residence still apply.
        </P>
      </Section>

      <Section title="Changes to these terms">
        <P>
          We may update these terms. Material changes are announced at least 30 days before taking effect. Continued use
          after the effective date means you accept the new terms.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Reach us at{" "}
          <a href="mailto:xavellis4@gmail.com" className="text-[#B48B40] hover:underline">xavellis4@gmail.com</a>{" "}
          with any question.
        </P>
      </Section>
    </LegalShell>
  );
}
