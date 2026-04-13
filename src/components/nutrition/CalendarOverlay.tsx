"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMealsForRange } from "@/lib/nutrition/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId:       string;
  selectedDate: string;        // YYYY-MM-DD currently viewed
  onSelect:     (date: string) => void;
  onClose:      () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS   = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildCalendar(year: number, month: number): (string | null)[] {
  const firstDay   = new Date(year, month, 1).getDay();  // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarOverlay({ userId, selectedDate, onSelect, onClose }: Props) {
  const today    = isoToday();
  const initDate = new Date(selectedDate + "T12:00:00");

  const [year,  setYear]  = useState(initDate.getFullYear());
  const [month, setMonth] = useState(initDate.getMonth());
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());

  // Load logged days for the visible month
  useEffect(() => {
    const start  = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastD  = new Date(year, month + 1, 0).getDate();
    const end    = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastD).padStart(2, "0")}`;
    const meals  = getMealsForRange(userId, start, end);
    setLoggedDates(new Set(meals.map((m) => m.eatenAt.slice(0, 10))));
  }, [userId, year, month]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const cells    = buildCalendar(year, month);
  const isFuture = (() => {
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-sm bg-[#0D0D0D] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/35 hover:text-white/65 hover:border-white/15 transition-all"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <h3 className="text-sm font-semibold text-white/75 tracking-tight">
            {MONTHS[month]} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={nextMonth}
              disabled={isFuture}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/35 hover:text-white/65 hover:border-white/15 disabled:opacity-25 transition-all"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/25 hover:text-white/55 transition-all ml-1"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 px-5 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[9px] uppercase tracking-[0.12em] text-white/22 font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-5 pb-6 gap-y-1">
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} />;
            }
            const isToday    = date === today;
            const isSelected = date === selectedDate;
            const hasLogs    = loggedDates.has(date);
            const isFutureDay = date > today;

            return (
              <button
                key={date}
                disabled={isFutureDay}
                onClick={() => { onSelect(date); onClose(); }}
                className={cn(
                  "relative flex flex-col items-center justify-center h-9 w-full rounded-xl text-sm transition-all",
                  isFutureDay && "opacity-20 cursor-not-allowed",
                  isSelected && !isFutureDay && "bg-[#B48B40]/15 border border-[#B48B40]/30 text-[#B48B40] font-semibold",
                  isToday && !isSelected && "border border-white/15 text-white/85 font-semibold",
                  !isSelected && !isToday && !isFutureDay && "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
                )}
              >
                {new Date(date + "T12:00:00").getDate()}
                {hasLogs && (
                  <span className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    isSelected ? "bg-[#B48B40]" : "bg-[#B48B40]/50",
                  )} />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 px-5 pb-5 text-[10px] text-white/25">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B48B40]/50" />
            Meals logged
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-md border border-white/15 inline-block" />
            Today
          </span>
        </div>
      </div>
    </div>
  );
}
