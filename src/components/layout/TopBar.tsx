"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLAN_LABELS } from "@/lib/plans";
import { User, Settings, LogOut } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";

const STATUS_RING: Record<string, string> = {
  active: "ring-[#4ADE80]/60",
  rest:   "ring-[#93C5FD]/50",
  off:    "ring-[#525252]/40",
};

const MENU_ITEMS = [
  { label: "View Profile", icon: User,     href: "/profile"  },
  { label: "Settings",     icon: Settings, href: "/profile"  },
  { label: "Log out",      icon: LogOut,   href: null        },
];

export function TopBar() {
  const { user, logout } = useUser();
  const router   = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef  = useRef<HTMLDivElement>(null);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handleItem(href: string | null) {
    setOpen(false);
    if (href) {
      router.push(href);
    } else {
      logout(); // clears storage + hard-navigates to /login
    }
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b border-white/5 bg-[#0A0A0A]/90 backdrop-blur-md">
      <Link
        href="/dashboard?tab=overview"
        className="text-sm font-semibold tracking-[0.25em] uppercase text-white/90 hover:text-white transition-colors"
      >
        Flowstate
      </Link>

      <div ref={menuRef} className="relative">
        {/* Avatar button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "relative flex items-center justify-center w-8 h-8 rounded-full bg-[#1C1C1C] text-[11px] font-semibold text-white/80 ring-2 ring-offset-2 ring-offset-[#0A0A0A] transition-all hover:ring-offset-[#1C1C1C]",
            STATUS_RING[user.status]
          )}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/8 bg-[#111111] shadow-2xl shadow-black/40 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-xs font-semibold text-white/75 truncate">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-white/28 capitalize">{user.role}</p>
                <span className="text-[8px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-md bg-[#B48B40]/15 text-[#B48B40]/70 border border-[#B48B40]/20">
                  {PLAN_LABELS[user.plan]}
                </span>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {MENU_ITEMS.map(({ label, icon: Icon, href }) => (
                <button
                  key={label}
                  onClick={() => handleItem(href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    href === null
                      ? "text-[#F87171]/70 hover:text-[#F87171] hover:bg-white/[0.02]"
                      : "text-white/55 hover:text-white/85 hover:bg-white/[0.03]"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
