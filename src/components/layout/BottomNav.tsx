"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Dumbbell, Bot, CheckSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import type { NavItem } from "@/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Home",    href: "/",               icon: Home },
  { label: "Program", href: "/program",        icon: Dumbbell },
  { label: "Coach",   href: "/coach",          icon: Bot },
  { label: "Track",   href: "/accountability", icon: CheckSquare },
  { label: "Profile", href: "/profile",        icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasAccess(user.role, item.roles[0])
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 border-t border-white/5 bg-[#0A0A0A]/95 backdrop-blur-md md:hidden">
      {visibleItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
              active
                ? "text-[#B48240]"
                : "text-[#525252] hover:text-[#A3A3A3] active:text-[#F5F5F5]"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5",
                active && "drop-shadow-[0_0_6px_rgba(180,130,64,0.5)]"
              )}
            />
            <span className="text-[10px] font-medium tracking-wide">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
