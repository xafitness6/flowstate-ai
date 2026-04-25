"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Non-scrolling content rendered below the title bar (e.g. tab buttons). */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky content anchored to the bottom of the sheet, above safe area. */
  footer?: React.ReactNode;
}

/**
 * Bottom-sheet modal with safe-area-aware max-height and sticky footer slot.
 *
 * Mobile:  full-width, anchored to bottom, max-height calc(100dvh - safe-top - 1rem)
 * md+:     centered modal, max-width 480px
 *
 * Body is scrollable. Footer (primary actions) is always visible.
 * Backdrop tap and Escape key both close the sheet.
 */
export function Sheet({
  open, onClose, title, header, children, footer,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasHeader = title || header !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full sm:max-w-[480px]",
          "bg-[#0D0D0D] border border-white/10 shadow-2xl",
          "rounded-t-2xl sm:rounded-2xl",
          "flex flex-col overflow-hidden",
        )}
        style={{ maxHeight: "calc(100dvh - var(--safe-top, 0px) - 1rem)" }}
      >
        {/* Non-scrolling header */}
        {hasHeader && (
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
            {title && (
              <div className={cn("flex items-center justify-between", header ? "mb-4" : "")}>
                <h2 className="text-sm font-semibold text-white/80 tracking-tight">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg border border-white/8 bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-white/65 transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            )}
            {header}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div
            className="shrink-0 px-5 pt-3 border-t border-white/[0.05]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
