"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Dumbbell, Utensils, Bot, User, LayoutDashboard, CheckSquare, CalendarDays, Users, Trophy, Film, Clapperboard, Wind, Lock, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import type { ViewMode } from "@/context/UserContext";
import { hasAccess, isAdmin } from "@/lib/roles";
import { planHasAccess, PLAN_LABELS } from "@/lib/plans";
import type { NavItem } from "@/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Home",           href: "/dashboard",      icon: Home },
  { label: "Program",        href: "/program",        icon: Dumbbell },
  { label: "Nutrition",      href: "/nutrition",      icon: Utensils,     roles: ["client"], plan: "training"   },
  { label: "Calendar",       href: "/calendar",       icon: CalendarDays, roles: ["client"], plan: "training"   },
  { label: "Coach",          href: "/coach",          icon: Bot,          roles: ["client"], plan: "training"   },
  { label: "Accountability", href: "/accountability", icon: CheckSquare },
  { label: "Breathwork",     href: "/breathwork",     icon: Wind },
  { label: "My Clients",     href: "/my-clients",     icon: UserCheck,    roles: ["trainer"]                },
  { label: "Library",        href: "/library",        icon: Film,         roles: ["trainer"], plan: "training"  },
  { label: "Form Analysis",  href: "/form",           icon: Clapperboard, roles: ["trainer"], plan: "performance"},
  { label: "Leaderboard",    href: "/leaderboard",    icon: Trophy },
  { label: "Profile",        href: "/profile",        icon: User },
];

export function Sidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const { user, viewMode, setViewMode } = useUser();

  function handleViewToggle() {
    const next: ViewMode = viewMode === "operator" ? "personal" : "operator";
    setViewMode(next);
    router.push(next === "personal" ? "/dashboard?tab=overview" : "/admin");
  }

  return (
    <aside className="hidden md:flex flex-col w-56 h-screen border-r border-white/5 bg-[#0D0D0D] px-3 py-6 gap-1 fixed top-0 left-0 z-30 overflow-y-auto">
      <div className="px-3 mb-6">
        <span className="text-sm font-semibold tracking-[0.25em] uppercase text-white/90">
          Flowstate
        </span>
      </div>

      {NAV_ITEMS
        // Role gate: hide completely if role is insufficient
        .filter((item) => !item.roles || hasAccess(user.role, item.roles[0]))
        .map((item) => {
          const active  = item.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/dashboard/")
            : pathname === item.href;
          const locked  = !!item.plan && !planHasAccess(user.plan, item.plan);
          const Icon    = item.icon;

          return (
            <Link
              key={item.href}
              href={locked ? "/pricing" : item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active  ? "bg-[#B48240]/10 text-[#B48240]"
                : locked ? "text-[#383838] hover:text-[#505050] hover:bg-white/[0.02]"
                :          "text-[#525252] hover:text-[#F5F5F5] hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {locked && (
                <span className="flex items-center gap-1 ml-auto">
                  <span className="text-[8px] uppercase tracking-[0.12em] text-[#B48B40]/40 font-medium">
                    {PLAN_LABELS[item.plan!]}
                  </span>
                  <Lock className="w-3 h-3 text-white/15" strokeWidth={1.5} />
                </span>
              )}
            </Link>
          );
        })}

      {isAdmin(user.role) && (
        <div className="mt-auto">
          <div className="h-px bg-white/5 mb-3" />

          {/* View mode toggle — operator ↔ personal */}
          <button
            onClick={handleViewToggle}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all mb-1",
              "text-[#525252] hover:text-[#F5F5F5] hover:bg-white/5"
            )}
          >
            {viewMode === "personal"
              ? <><LayoutDashboard className="w-4 h-4 shrink-0" /><span>Platform View</span></>
              : <><User className="w-4 h-4 shrink-0" /><span>My Training</span></>
            }
          </button>

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
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/admin"
                ? "bg-[#B48240]/10 text-[#B48240]"
                : "text-[#525252] hover:text-[#A3A3A3] hover:bg-white/5"
            )}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            Admin
          </Link>
        </div>
      )}
    </aside>
  );
}
