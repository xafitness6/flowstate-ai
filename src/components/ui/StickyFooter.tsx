import { cn } from "@/lib/utils";

/**
 * Sticky bottom action bar.
 *
 * Inside a Sheet's scrollable body: sticks to the bottom of the visible
 * scroll area so primary CTAs are always reachable.
 *
 * Standalone on full-page flows: sticks to the bottom of the viewport,
 * padded above the home indicator via env(safe-area-inset-bottom).
 */
export function StickyFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10",
        "bg-[#0d0d0d]",
        "border-t border-white/[0.06]",
        "px-5 pt-3",
        className,
      )}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      {children}
    </div>
  );
}
