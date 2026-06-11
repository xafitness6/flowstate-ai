import Link from "next/link";

/**
 * Editorial-premium shell for /privacy, /terms, /disclaimer.
 * Same visual language as the V2 dashboard — single column, ambient warmth,
 * type-led hierarchy. Used pre-auth, so no in-app nav.
 *
 * Children supply the body. The shell adds the page-top brand row, the
 * common in-page legal nav, and the footer with contact email.
 */
export function LegalShell({
  title,
  effective,
  intro,
  children,
}: {
  title:     string;
  effective: string;
  intro?:    string;
  children:  React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen text-white">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_-5%,rgba(180,139,64,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0908_0%,#0B0908_100%)] -z-10" />
      </div>

      <div className="relative mx-auto max-w-[680px] px-6 md:px-8 pt-10 md:pt-14 pb-24 space-y-14">
        {/* Brand + in-page nav */}
        <header className="flex items-center justify-between">
          <Link href="/" className="text-[13px] tracking-[0.18em] font-medium text-white/65 hover:text-white/85 transition-colors">
            FLOWSTATE
          </Link>
          <nav className="flex items-center gap-6 text-[12px] text-white/40">
            <Link href="/privacy"    className="hover:text-[#B48B40] transition-colors">Privacy</Link>
            <Link href="/terms"      className="hover:text-[#B48B40] transition-colors">Terms</Link>
            <Link href="/disclaimer" className="hover:text-[#B48B40] transition-colors">Disclaimer</Link>
          </nav>
        </header>

        {/* Title block */}
        <header className="space-y-4">
          <div className="flex items-center gap-3 text-[12px] text-white/30">
            <span>Effective {effective}</span>
            <span className="h-px w-8 bg-white/15" aria-hidden />
            <span>Last updated</span>
          </div>
          <h1 className="text-[44px] md:text-[56px] font-medium tracking-[-0.025em] leading-[0.95]">{title}</h1>
          {intro && (
            <p className="text-[15px] text-white/55 leading-relaxed max-w-[34rem]">{intro}</p>
          )}
        </header>

        {/* Body — content authors compose using <Section/>, <P/>, <Bullet/> below */}
        <article className="space-y-10 leading-relaxed">
          {children}
        </article>

        <footer className="pt-10 border-t border-white/[0.06] text-[12px] text-white/35 flex items-center justify-between">
          <p>© Flowstate AI</p>
          <a
            href="mailto:xavellis4@gmail.com"
            className="hover:text-[#B48B40] transition-colors"
          >
            xavellis4@gmail.com
          </a>
        </footer>
      </div>
    </div>
  );
}

/** A titled section. Title is a quiet h2; body wraps in editorial spacing. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-[20px] font-medium text-white/85 tracking-tight">{title}</h2>
      <div className="space-y-4 text-[15px] text-white/65 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/** Standard paragraph. */
export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

/** Bulleted line, using a gold tick. */
export function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 leading-relaxed">
      <span aria-hidden className="text-[#B48B40]/70 shrink-0 leading-[1.55]">·</span>
      <span>{children}</span>
    </li>
  );
}

/** Inline data row used inside Section to map a label to a value. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-2 border-b border-white/[0.05] last:border-b-0">
      <p className="text-[13px] text-white/45">{label}</p>
      <div className="text-[14px] text-white/75">{children}</div>
    </div>
  );
}
