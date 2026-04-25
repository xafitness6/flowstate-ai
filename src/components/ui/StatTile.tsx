import { cn } from "@/lib/utils";
import { type as typeScale } from "@/lib/design-tokens";

export function StatTile({
  value,
  label,
  unit,
  valueClassName,
  bar,
  barColor,
}: {
  value: string | number;
  label: string;
  unit?: string;
  valueClassName?: string;
  bar?: number;
  barColor?: string;
}) {
  return (
    <div>
      <p className={cn(typeScale.statValue, "tabular-nums", valueClassName)}>
        {value}
        {unit && <span className="text-sm text-white/35 ml-1">{unit}</span>}
      </p>
      <p className={cn(typeScale.statLabel, "mt-0.5")}>{label}</p>
      {bar !== undefined && (
        <div className="h-0.5 rounded-full bg-white/8 mt-2">
          <div
            className={cn("h-full rounded-full", barColor ?? "bg-[#B48B40]")}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}
