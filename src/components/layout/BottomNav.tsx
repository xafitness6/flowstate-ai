"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, LayoutDashboard, Lock, Menu, Plus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { hasAccess } from "@/lib/roles";
import { planHasAccess, PLAN_LABELS } from "@/lib/plans";
import { useEntitlement } from "@/hooks/useEntitlement";
import { NAV_ITEMS, type AppNavItem } from "./Sidebar";

const STORAGE_KEY = "flowstate-bottomnav-items-v2";
const MAX_PINNED = 5;
const DEFAULT_PINNED = ["/dashboard", "/program", "/nutrition", "/calendar", "/coach"];
const HOME_HREF = "/dashboard";

function unique(values: string[]) {
  return [...new Set(values)];
}

function homeFirst(values: string[]) {
  if (!values.includes(HOME_HREF)) return values;
  return [HOME_HREF, ...values.filter((href) => href !== HOME_HREF)];
}

function routeActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard" || pathname.startsWith("/dashboard/")
    : pathname === href || pathname.startsWith(`${href}/`);
}

function normalizePins(saved: string[] | null, eligible: AppNavItem[]) {
  const allowed = new Set(eligible.map((item) => item.href));
  const source = saved ?? DEFAULT_PINNED;
  const pins = homeFirst(unique(source).filter((href) => allowed.has(href))).slice(0, MAX_PINNED);

  if (saved && pins.length > 0) return homeFirst(pins);

  for (const href of DEFAULT_PINNED) {
    if (pins.length >= MAX_PINNED) break;
    if (allowed.has(href) && !pins.includes(href)) pins.push(href);
  }
  for (const item of eligible) {
    if (pins.length >= MAX_PINNED) break;
    if (!pins.includes(item.href)) pins.push(item.href);
  }
  return homeFirst(pins);
}

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const { can } = useEntitlement();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loadedPins, setLoadedPins] = useState(false);
  const [pinnedHrefs, setPinnedHrefs] = useState<string[]>([]);

  function locked(item: AppNavItem) {
    return item.feature ? !can(item.feature) : !!item.plan && !planHasAccess(user.plan, item.plan);
  }

  const roleVisible = useMemo(
    () => NAV_ITEMS.filter((item) => !item.roles || hasAccess(user.role, item.roles[0])),
    [user.role],
  );
  const unlocked = roleVisible.filter((item) => !locked(item));
  const eligibleKey = unlocked.map((item) => item.href).join("|");

  useEffect(() => {
    let saved: string[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) saved = parsed.filter((v): v is string => typeof v === "string");
    } catch { /* ignore */ }
    setPinnedHrefs(normalizePins(saved, unlocked));
    setLoadedPins(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loadedPins) return;
    setPinnedHrefs((prev) => {
      const next = normalizePins(prev, unlocked);
      return next.join("|") === prev.join("|") ? prev : next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleKey, loadedPins]);

  useEffect(() => {
    if (!loadedPins) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedHrefs)); } catch { /* ignore */ }
  }, [loadedPins, pinnedHrefs]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const pinnedItems = pinnedHrefs
    .map((href) => unlocked.find((item) => item.href === href))
    .filter((item): item is AppNavItem => Boolean(item));

  const isOperator = user.role === "master" || user.isAdmin;
  const adminItems: AppNavItem[] = isOperator
    ? [
        { label: "Trainers", href: "/trainers", icon: Users },
        { label: "Admin", href: "/admin", icon: LayoutDashboard },
      ]
    : [];
  const fullMenuItems = [...roleVisible, ...adminItems];

  function togglePin(item: AppNavItem) {
    if (locked(item)) return;
    setPinnedHrefs((prev) => {
      if (prev.includes(item.href)) return homeFirst(prev.filter((href) => href !== item.href));
      if (prev.length >= MAX_PINNED) return prev;
      return homeFirst([...prev, item.href]);
    });
  }

  const gridCount = Math.max(1, pinnedItems.length + 1);

  return (
    <>
      <nav className="fs-bottom-nav fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-white/5 bg-[#0A0A0A]/95 backdrop-blur-md md:hidden">
        <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${gridCount}, minmax(0, 1fr))` }}>
          {pinnedItems.map((item) => (
            <BottomNavLink
              key={item.href}
              item={item}
              active={routeActive(pathname, item.href)}
              locked={false}
              onClick={() => setOpen(false)}
            />
          ))}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "fs-bottom-nav-item relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 transition-colors",
              open ? "fs-bottom-nav-item-active text-[#B48240]" : "text-[#525252] hover:text-[#A3A3A3] active:text-[#F5F5F5]",
            )}
            aria-label="Open navigation menu"
          >
            <Menu className={cn("w-5 h-5", open && "drop-shadow-[0_0_6px_rgba(180,130,64,0.5)]")} strokeWidth={1.8} />
            <span className="text-[9px] font-medium">Menu</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />
          <div
            ref={menuRef}
            className="fs-bottom-nav-sheet absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-white/[0.08] bg-[#0D0D0D] px-4 pb-6 pt-4 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-sm font-semibold text-white/85">Navigation</p>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/45 hover:text-white/80 hover:bg-white/[0.04]"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {fullMenuItems.map((item) => {
                const isLocked = locked(item);
                const Icon = item.icon;
                const active = routeActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={isLocked ? "/pricing" : item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-[#B48B40]/30 bg-[#B48B40]/10 text-[#B48B40]"
                        : isLocked
                          ? "border-white/[0.04] bg-white/[0.015] text-white/25"
                          : "border-white/[0.06] bg-white/[0.025] text-white/65 hover:border-white/15 hover:text-white/90",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isLocked && <Lock className="w-3 h-3 shrink-0 text-white/20" strokeWidth={1.6} />}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Bottom bar</p>
              <p className="text-[10px] text-white/25">{pinnedHrefs.length}/{MAX_PINNED}</p>
            </div>
            <div className="space-y-1.5">
              {roleVisible.map((item) => {
                const isLocked = locked(item);
                const pinned = pinnedHrefs.includes(item.href);
                const atMax = pinnedHrefs.length >= MAX_PINNED;
                const disabled = isLocked || (!pinned && atMax);
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => togglePin(item)}
                    disabled={disabled}
                    className={cn(
                      "flex w-full min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
                      pinned
                        ? "border-[#B48B40]/25 bg-[#B48B40]/8 text-white/85"
                        : disabled
                          ? "border-white/[0.04] bg-white/[0.01] text-white/25"
                          : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white/85 hover:border-white/15",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isLocked && item.plan && (
                      <span className="text-[9px] uppercase tracking-[0.12em] text-[#B48B40]/45">
                        {PLAN_LABELS[item.plan]}
                      </span>
                    )}
                    {pinned ? (
                      <Check className="w-4 h-4 shrink-0 text-[#B48B40]" strokeWidth={2} />
                    ) : isLocked ? (
                      <Lock className="w-3.5 h-3.5 shrink-0 text-white/18" strokeWidth={1.6} />
                    ) : (
                      <Plus className="w-4 h-4 shrink-0 text-white/35" strokeWidth={1.8} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BottomNavLink({
  item,
  active,
  locked,
  onClick,
}: {
  item: AppNavItem;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={locked ? "/pricing" : item.href}
      onClick={onClick}
      className={cn(
        "fs-bottom-nav-item relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 transition-colors",
        active ? "fs-bottom-nav-item-active text-[#B48240]"
        : locked ? "text-[#363636]"
        : "text-[#525252] hover:text-[#A3A3A3] active:text-[#F5F5F5]",
      )}
    >
      <div className="relative">
        <Icon
          className={cn(
            "w-5 h-5",
            active && "drop-shadow-[0_0_6px_rgba(180,130,64,0.5)]",
          )}
        />
        {locked && <Lock className="absolute -right-1 -top-1 h-2.5 w-2.5 text-white/20" strokeWidth={2} />}
      </div>
      <span className="max-w-full truncate text-[9px] font-medium">{item.label}</span>
    </Link>
  );
}
