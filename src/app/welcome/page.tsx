"use client";

import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";

// ─── Welcome / Landing ────────────────────────────────────────────────────────
// Entry point for unauthenticated visitors.
// No role selection — users go directly to /login.

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-10">

        {/* Brand */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">
              The performance<br />
              <span className="text-white/50">operating system.</span>
            </h1>
            <p className="text-sm text-white/35 leading-relaxed">
              AI-powered coaching, programming, and nutrition — in one place.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 bg-[#B48B40] text-black text-sm font-semibold tracking-wide hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
          >
            Get started
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>

          <Link
            href="/login"
            className="w-full flex items-center justify-center rounded-2xl py-3.5 border border-white/8 text-sm text-white/45 hover:text-white/65 hover:border-white/15 transition-all"
          >
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}
