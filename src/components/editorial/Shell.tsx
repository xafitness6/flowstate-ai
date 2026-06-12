// Shared editorial-premium page shell.
// Ambient warm vignette + single-column composition + standard padding.
// Use this on top-level in-app pages so every surface speaks the same
// visual language as the redesigned dashboard.

import { cn } from "@/lib/utils";

export function EditorialShell({
  children,
  className,
  maxWidth = 760,
}: {
  children:   React.ReactNode;
  className?: string;
  maxWidth?:  640 | 720 | 760 | 880;
}) {
  return (
    <div className={cn("relative min-h-screen text-white", className)}>
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_50%_-5%,rgba(180,139,64,0.07),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0A0908_0%,#0B0908_100%)] -z-10" />
      </div>
      <div
        className="relative mx-auto px-6 md:px-8 pt-10 md:pt-14 pb-28 space-y-16 md:space-y-20"
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );
}
