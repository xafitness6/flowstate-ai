"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getLoginGreeting } from "@/lib/greeting";

export function GreetingBanner() {
  const [message,  setMessage ] = useState<string | null>(null);
  const [visible,  setVisible ] = useState(false);
  const [exiting,  setExiting ] = useState(false);

  useEffect(() => {
    const result = getLoginGreeting();
    if (!result) return;

    setMessage(result.message);

    // Slight delay lets the page paint first, then fade in
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(() => setMessage(null), 300);
  }

  if (!message) return null;

  return (
    <div
      className="mb-6 transition-all duration-500 ease-out"
      style={{
        opacity:   visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? "translateY(0)" : "translateY(-6px)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Gold accent bar */}
        <div className="w-[2px] self-stretch rounded-full bg-[#B48B40]/35 shrink-0 mt-0.5" />

        {/* Message */}
        <p className="flex-1 text-sm text-white/50 leading-snug">
          {message}
        </p>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="shrink-0 text-white/18 hover:text-white/40 transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
