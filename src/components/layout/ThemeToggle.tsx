"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeMode = "dark" | "light";

const THEME_KEY = "flowstate-theme";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("theme-light", mode === "light");
  root.style.colorScheme = mode;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: ThemeMode = "dark";
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch { /* ignore */ }
    setMode(stored);
    applyTheme(stored);
    setReady(true);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  }

  const isLight = mode === "light";
  const Icon = isLight ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Dark theme" : "Light theme"}
      className={cn(
        "fs-topbar-icon-button w-8 h-8 rounded-full border border-white/8 bg-[#1C1C1C] flex items-center justify-center transition-all",
        "text-white/45 hover:text-white/80 hover:border-white/16 hover:bg-white/[0.05]",
        !ready && "opacity-0",
      )}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
    </button>
  );
}
