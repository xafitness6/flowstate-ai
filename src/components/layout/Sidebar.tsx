"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Dumbbell, Utensils, Bot, User, LayoutDashboard, CheckSquare, CalendarDays, Users, Trophy, Film, Clapperboard, Wind, Lock, UserCheck, LineChart, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import type { ViewMode } from "@/context/UserContext";
import { hasAccess, isAdmin } from "@/lib/roles";
import { planHasAccess, PLAN_LABELS } from "@/lib/plans";
import { FEATURES, type Feature } from "@/lib/entitlements";
import { useEntitlement } from "@/hooks/useEntitlement";
import type { NavItem } from "@/types";

export type AppNavItem = NavItem & { feature?: Feature };

export const NAV_ITEMS: AppNavItem[] = [
  { label: "Home",           href: "/dashboard",      icon: Home,         feature: FEATURES.DASHBOARD },
  { label: "Program",        href: "/program",        icon: Dumbbell,     feature: FEATURES.PROGRAM_VIEW },
  { label: "Nutrition",      href: "/nutrition",      icon: Utensils,     roles: ["client"], plan: "training", feature: FEATURES.NUTRITION },
  { label: "Calendar",       href: "/calendar",       icon: CalendarDays, feature: FEATURES.CALENDAR },
  { label: "Progress",       href: "/progress",       icon: LineChart },
  { label: "Coach",          href: "/coach",          icon: Bot,          roles: ["client"], plan: "training", feature: FEATURES.COACH },
  { label: "Accountability", href: "/accountability", icon: CheckSquare,  feature: FEATURES.ACCOUNTABILITY_BASIC },
  { label: "Learn",          href: "/learn",          icon: GraduationCap },
  { label: "Breathwork",     href: "/breathwork",     icon: Wind,         feature: FEATURES.BREATHWORK },
  { label: "My Clients",     href: "/my-clients",     icon: UserCheck,    roles: ["trainer"] },
  { label: "Library",        href: "/library",        icon: Film,         roles: ["trainer"], plan: "training" },
  { label: "Form Analysis",  href: "/form",           icon: Clapperboard, roles: ["member"],  plan: "coaching", feature: FEATURES.FORM_ANALYSIS, staffUnlocked: true },
  { label: "Leaderboard",    href: "/leaderboard",    icon: Trophy,       feature: FEATURES.LEADERBOARD },
  { label: "Profile",        href: "/profile",        icon: User },
];

export function Sidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const { user, viewMode, setViewMode } = useUser();
  const { can } = useEntitlement();
  const staffViewer = user.role === "trainer" || user.role === "master" || !!user.isAdmin;

  function handleViewToggle() {
    const next: ViewMode = viewMode === "operator" ? "personal" : "operator";
    setViewMode(next);
    router.push(next === "personal" ? "/dashboard?tab=overview" : "/admin");
  }

  return (
    <aside className="fs-sidebar hidden md:flex flex-col w-56 h-screen border-r border-white/5 bg-[#0D0D0D] px-3 py-6 gap-1 fixed top-0 left-0 z-30 overflow-y-auto">
      <div className="px-3 mb-6">
        <span className="fs-sidebar-brand text-sm font-semibold tracking-[0.25em] uppercase text-white/90">
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
          const locked  = item.staffUnlocked && staffViewer
            ? false
            : item.feature ? !can(item.feature) : !!item.plan && !planHasAccess(user.plan, item.plan);
          const Icon    = item.icon;

          return (
            <Link
              key={item.href}
              href={locked ? "/pricing" : item.href}
              className={cn(
                "fs-sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active  ? "fs-sidebar-link-active bg-[#B48240]/10 text-[#B48240]"
                : locked ? "fs-sidebar-link-locked text-[#383838] hover:text-[#505050] hover:bg-white/[0.02]"
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
          <div className="fs-sidebar-divider h-px bg-white/5 mb-3" />

          {/* View mode toggle — operator ↔ personal */}
          <button
            onClick={handleViewToggle}
            className={cn(
              "fs-sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-all mb-1",
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
              "fs-sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/trainers" || pathname.startsWith("/trainers/")
                ? "fs-sidebar-link-active bg-[#B48240]/10 text-[#B48240]"
                : "text-[#525252] hover:text-[#A3A3A3] hover:bg-white/5"
            )}
          >
            <Users className="w-4 h-4 shrink-0" />
            Trainers
          </Link>
          <Link
            href="/admin"
            className={cn(
              "fs-sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/admin"
                ? "fs-sidebar-link-active bg-[#B48240]/10 text-[#B48240]"
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
