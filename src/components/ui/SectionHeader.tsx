import { cn } from "@/lib/utils";
import { type as typeScale } from "@/lib/design-tokens";

export function SectionHeader({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  if (action) {
    return (
      <div className={cn("flex items-center justify-between mb-3", className)}>
        <p className={typeScale.section}>{children}</p>
        {action}
      </div>
    );
  }
  return (
    <p className={cn(typeScale.section, "mb-3", className)}>{children}</p>
  );
}
