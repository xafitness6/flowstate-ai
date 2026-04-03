"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Bot, CheckSquare, User, Wind, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { planHasAccess } from "@/lib/plans";
import type { NavItem } from "@/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Home",    href: "/dashboard",      icon: Home },
  { label: "Program", href: "/program",        icon: Dumbbell },
  { label: "Coach",   href: "/coach",          icon: Bot,  roles: ["client"], plan: "training" },
  { label: "Track",     href: "/accountability", icon: CheckSquare },
  { label: "Breathe",  href: "/breathwork",    icon: Wind },
  { label: "Profile",  href: "/profile",       icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user }  = useUser();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasAccess(user.role, item.roles[0])
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 border-t border-white/5 bg-[#0A0A0A]/95 backdrop-blur-md md:hidden">
      {visibleItems.map((item) => {
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
              "relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
              active  ? "text-[#B48240]"
              : locked ? "text-[#363636]"
              :          "text-[#525252] hover:text-[#A3A3A3] active:text-[#F5F5F5]"
            )}
          >
            <div className="relative">
              <Icon
                className={cn(
                  "w-5 h-5",
                  active && "drop-shadow-[0_0_6px_rgba(180,130,64,0.5)]"
                )}
              />
              {locked && (
                <Lock className="absolute -top-1 -right-1 w-2.5 h-2.5 text-white/20" strokeWidth={2} />
              )}
            </div>
            <span className="text-[10px] font-medium tracking-wide">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
