"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full border border-red-400/20 bg-red-400/10 flex items-center justify-center">
          <span className="text-xl text-red-300">!</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Flowstate hit a loading issue.</h1>
          <p className="text-sm text-white/45">
            Refresh the page, or return to login and sign in again.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#B48B40] px-4 py-3 text-sm font-semibold text-black hover:bg-[#c99840] transition-colors"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/65 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
