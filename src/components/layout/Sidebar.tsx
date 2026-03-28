"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Utensils, Bot, User, LayoutDashboard, CheckSquare, CalendarDays, Users, Trophy, Film, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { isMaster } from "@/lib/roles";
import type { NavItem } from "@/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Home",           href: "/",               icon: Home },
  { label: "Program",        href: "/program",        icon: Dumbbell },
  { label: "Nutrition",      href: "/nutrition",      icon: Utensils },
  { label: "Calendar",       href: "/calendar",       icon: CalendarDays },
  { label: "Coach",          href: "/coach",          icon: Bot },
  { label: "Accountability", href: "/accountability", icon: CheckSquare },
  { label: "Library",       href: "/library",        icon: Film },
  { label: "Form Analysis", href: "/form",           icon: Clapperboard },
  { label: "Leaderboard",   href: "/leaderboard",    icon: Trophy },
  { label: "Profile",       href: "/profile",        icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen border-r border-white/5 bg-[#0D0D0D] px-3 py-6 gap-1 sticky top-0 h-screen">
      <div className="px-3 mb-6">
        <span className="text-sm font-semibold tracking-[0.25em] uppercase text-white/90">
          Flowstate
        </span>
      </div>

      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              active
                ? "bg-[#B48240]/10 text-[#B48240]"
                : "text-[#525252] hover:text-[#F5F5F5] hover:bg-white/5"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}

      {isMaster(user.role) && (
        <div className="mt-auto">
          <div className="h-px bg-white/5 mb-3" />
          <Link
            href="/trainers"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/trainers" || pathname.startsWith("/trainers/")
                ? "bg-[#B48240]/10 text-[#B48240]"
                : "text-[#525252] hover:text-[#A3A3A3] hover:bg-white/5"
            )}
          >
            <Users className="w-4 h-4 shrink-0" />
            Trainers
          </Link>
          <Link
            href="/master"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/master"
                ? "bg-[#B48240]/10 text-[#B48240]"
                : "text-[#525252] hover:text-[#A3A3A3] hover:bg-white/5"
            )}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Master
          </Link>
        </div>
      )}
    </aside>
  );
}
