// Editorial page cover — replaces the V1 "h1 + uppercase tag chips" pattern.
//
// Anatomy:
//   meta:    thin hairline row of date / role / context (optional)
//   eyebrow: tiny light-weight line above the title (optional)
//   title:   the page's anchor — type as primary hierarchy
//   subline: short personal/contextual line below
//
// Pattern: light secondary eyebrow over a medium-weight title is the
// reverse of the V1 default, and the gentlest way to give the page an
// anchor without tells.

import { cn } from "@/lib/utils";

type Meta = string | { label: string };

export function EditorialCover({
  meta,
  eyebrow,
  title,
  subline,
  size = "lg",
}: {
  meta?:    Meta[];
  eyebrow?: string;
  title:    string;
  subline?: string;
  size?:    "lg" | "md";
}) {
  const titleClass =
    size === "lg"
      ? "text-[44px] md:text-[56px] leading-[0.95]"
      : "text-[36px] md:text-[44px] leading-[1]";

  return (
    <header className="space-y-4">
      {meta && meta.length > 0 && (
        <div className="flex items-center gap-3 text-[12px] text-white/30 tabular-nums flex-wrap">
          {meta.map((m, i) => (
            <span key={i} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="h-px w-6 bg-white/15" />}
              <span className={i === 0 ? "" : "text-white/45"}>
                {typeof m === "string" ? m : m.label}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-[20px] md:text-[24px] font-extralight text-white/45 leading-none">
            {eyebrow}
          </p>
        )}
        <h1 className={cn(titleClass, "font-medium tracking-[-0.025em]")}>{title}</h1>
      </div>
      {subline && (
        <p className="text-[15px] text-white/55 leading-relaxed max-w-[34rem]">{subline}</p>
      )}
    </header>
  );
}
