// Editorial-premium primitives. Compose pages from these instead of
// hand-rolling rounded-2xl bordered cards everywhere.
//
// Conventions:
// - SectionTitle: sentence-case medium-weight 20px. NO uppercase tracking.
// - NavRow:       hairline-divided link rows (the "Continue" pattern).
// - Pulse:        big tabular numeral + tiny label, optional gold accent.
// - Block:        type-led labelled value pair (replaces small bordered cards).
// - HeroBlock:    the ONE bordered card per page — the actual CTA.

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export { EditorialShell } from "./Shell";
export { EditorialCover } from "./Cover";

/** Quiet section header. 20px medium, sentence case. */
export function SectionTitle({
  children, action, className,
}: {
  children:   React.ReactNode;
  action?:    React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between mb-6 md:mb-7", className)}>
      <h2 className="text-[20px] font-medium text-white/85 tracking-tight">{children}</h2>
      {action && <div className="text-[12px] text-white/35">{action}</div>}
    </div>
  );
}

/** Editorial nav row — used in lists (Continue, Settings, etc). */
export function NavRow({
  icon: Icon, label, hint, href, onClick, accent,
}: {
  icon:    React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label:   string;
  hint?:   string;
  href?:   string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-5 min-w-0">
        <Icon
          className={cn(
            "w-[18px] h-[18px] shrink-0 transition-colors",
            accent ? "text-[#B48B40]" : "text-white/35 group-hover:text-[#B48B40]",
          )}
          strokeWidth={1.5}
        />
        <div className="min-w-0">
          <p className="text-[15px] text-white/85 group-hover:text-white transition-colors">{label}</p>
          {hint && <p className="text-[12px] text-white/35 mt-0.5">{hint}</p>}
        </div>
      </div>
      <ArrowRight
        className="w-3.5 h-3.5 text-white/15 group-hover:text-[#B48B40] group-hover:translate-x-0.5 transition-all shrink-0"
        strokeWidth={2}
      />
    </>
  );
  const classes = "group flex items-center justify-between gap-4 py-5 transition-colors";
  if (href) return <Link href={href} className={classes}>{inner}</Link>;
  return <button onClick={onClick} className={cn(classes, "w-full text-left")}>{inner}</button>;
}

/** Hairline-divided list wrapper. Use around NavRow stacks. */
export function HairlineList({
  children, className,
}: {
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-white/[0.06] border-t border-b border-white/[0.06]", className)}>
      {children}
    </div>
  );
}

/** Big tabular number with small label — for confident metrics. */
export function Pulse({
  label, value, suffix, accent, sub,
}: {
  label:   string;
  value:   string | number;
  suffix?: string;
  accent?: boolean;
  sub?:    string;
}) {
  return (
    <div className="text-center">
      <p className={cn(
        "text-[34px] md:text-[42px] font-medium tabular-nums leading-none tracking-tight",
        accent ? "text-[#B48B40]" : "text-white/90",
      )}>
        {value}
        {suffix && <span className="text-white/30 text-[18px] md:text-[20px] font-extralight">{suffix}</span>}
      </p>
      <p className="text-[11px] text-white/35 mt-2.5">{label}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Three pulses side by side with hairline dividers, no card border. */
export function PulseStrip({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
      {/* Each child renders into its own dark cell so the gap-px shows as the
          divider line. */}
      {React.Children.map(children, (child) => (
        <div className="bg-[#0A0908] px-5 py-6">{child}</div>
      ))}
    </section>
  );
}

/** Type-led data block — replaces small bordered "stat tile" cards. */
export function DataBlock({
  label, value, sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?:  React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-white/35 mb-1.5">{label}</p>
      <p className="text-[18px] font-medium text-white/90 tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[12px] text-white/40 mt-1">{sub}</p>}
    </div>
  );
}

/** The ONE bordered CTA per page. Generous padding, warm corner glow. */
export function HeroBlock({
  href, onClick, eyebrow, title, subline, icon,
}: {
  href?:    string;
  onClick?: () => void;
  eyebrow?: string;
  title:    string;
  subline?: string;
  icon?:    React.ReactNode;
}) {
  const inner = (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(80%_50%_at_85%_15%,rgba(180,139,64,0.10),transparent_55%)]" />
      <div className="relative flex items-start justify-between gap-6">
        <div className="space-y-3 min-w-0">
          {eyebrow && <p className="text-[11px] tracking-[0.08em] text-[#B48B40]/75 font-medium">{eyebrow}</p>}
          <p className="text-[26px] md:text-[30px] font-medium tracking-tight leading-[1.05]">
            {title}
          </p>
          {subline && <p className="text-[13px] text-white/45 leading-relaxed max-w-[22rem]">{subline}</p>}
        </div>
        <div className="shrink-0 mt-1 w-11 h-11 rounded-full border border-[#B48B40]/35 flex items-center justify-center transition-all group-hover:bg-[#B48B40]/10 group-hover:border-[#B48B40]/65 group-hover:translate-x-0.5">
          {icon ?? <ArrowRight className="w-4 h-4 text-[#B48B40]" strokeWidth={2} />}
        </div>
      </div>
    </>
  );
  const classes = "group block relative rounded-[28px] border border-[#B48B40]/22 bg-gradient-to-b from-[#100D08] to-[#0A0908] px-7 md:px-9 py-8 md:py-10 transition-all hover:border-[#B48B40]/45 hover:shadow-[0_24px_48px_-24px_rgba(180,139,64,0.35)]";
  if (href) return <Link href={href} className={classes}>{inner}</Link>;
  return <button onClick={onClick} className={cn(classes, "w-full text-left")}>{inner}</button>;
}

