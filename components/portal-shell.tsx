"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, CalendarDays, ChartNoAxesCombined, ChevronDown, CircleDollarSign, ClipboardCheck, ClipboardList,
  BadgeEuro, HeartHandshake, IdCard, KeyRound, LayoutDashboard, Library, LogOut, Megaphone, Menu, MessageCircle, RadioTower, ReceiptText, Settings, ShieldCheck, Sparkles, UserRoundCog, Users, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getAllowedRoles, getPrimaryRole, hasAllowedRole, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { LanguageProvider, useT } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { TranslationKey } from "@/lib/i18n";

const nav = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.members", href: "/members", icon: Users },
  { labelKey: "nav.departments", href: "/departments", icon: ShieldCheck },
  { labelKey: "nav.attendance", href: "/attendance", icon: ClipboardCheck },
  { labelKey: "nav.operations", href: "/operations", icon: ClipboardList },
  { labelKey: "nav.finance", href: "/offerings", icon: CircleDollarSign },
  { labelKey: "nav.onlineGiving", href: "/giving", icon: BadgeEuro },
  { labelKey: "nav.givingHistory", href: "/giving-history", icon: ReceiptText },
  { labelKey: "nav.events", href: "/events", icon: CalendarDays },
  { labelKey: "nav.announcements", href: "/announcements", icon: Megaphone },
  { labelKey: "nav.prayerRequests", href: "/prayer-requests", icon: HeartHandshake },
  { labelKey: "nav.sermonArchive", href: "/sermons", icon: Library },
  { labelKey: "nav.livestream", href: "/livestream", icon: RadioTower },
  { labelKey: "nav.whatsapp", href: "/whatsapp", icon: MessageCircle },
  { labelKey: "nav.reports", href: "/reports", icon: ChartNoAxesCombined },
  { labelKey: "nav.advancedModules", href: "/advanced-modules", icon: Sparkles },
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
  { labelKey: "nav.manageUsers", href: "/users", icon: UserRoundCog },
];

const memberNav = [
  { labelKey: "nav.memberDashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.myProfile", href: "/my-profile", icon: IdCard },
  { labelKey: "nav.myAttendance", href: "/my-attendance", icon: ClipboardCheck },
  { labelKey: "nav.myContributions", href: "/my-contributions", icon: ReceiptText },
  { labelKey: "nav.prayerRequests", href: "/prayer-requests", icon: HeartHandshake },
  { labelKey: "nav.events", href: "/events", icon: CalendarDays },
  { labelKey: "nav.announcements", href: "/announcements", icon: Megaphone },
  { labelKey: "nav.sermons", href: "/sermons", icon: Library },
];

type PortalUser = { name: string; email: string; roles: AppRole[] };

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function Sidebar({ onNavigate, user, onLogout }: { onNavigate?: () => void; user: PortalUser; onLogout: () => void }) {
  const pathname = usePathname();
  const t = useT();
  const primaryRole = ROLE_LABELS[getPrimaryRole(user.roles)];
  const initials = getInitials(user.name);
  const navItems = getPrimaryRole(user.roles) === "member" ? memberNav : nav;
  const allowedNav = navItems.filter(({ href }) => {
    const roles = getAllowedRoles(href);
    return roles && hasAllowedRole(user.roles, roles);
  });
  return (
    <aside className="flex h-full flex-col bg-navy-deep text-white">
      <div className="flex h-[78px] items-center gap-3 border-b border-white/10 px-5">
        <LogoMark small />
        <div>
          <p className="text-sm font-bold leading-tight">Hamburg Ghana</p>
          <p className="mt-0.5 text-xs text-blue-200">SDA Church</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {allowedNav.map(({ labelKey, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              href={href}
              key={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-churchblue text-white" : "text-blue-100 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-[18px] w-[18px]" /> {t(labelKey as TranslationKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy-deep">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            <p className="text-[11px] text-blue-200">{primaryRole}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-blue-200" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          <Link href="/change-password" onClick={onNavigate} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold text-blue-100 hover:bg-white/10 hover:text-white">
            <KeyRound className="h-3.5 w-3.5" /> {t("common.password")}
          </Link>
          <button onClick={onLogout} className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold text-blue-100 hover:bg-white/10 hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> {t("common.logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function PortalShell({ children, user }: { children: React.ReactNode; user: PortalUser }) {
  return (
    <LanguageProvider>
      <PortalShellContent user={user}>{children}</PortalShellContent>
    </LanguageProvider>
  );
}

function PortalShellContent({ children, user }: { children: React.ReactNode; user: PortalUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const primaryRole = ROLE_LABELS[getPrimaryRole(user.roles)];
  const initials = getInitials(user.name);

  async function handleLogout() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cloud">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block"><Sidebar user={user} onLogout={handleLogout} /></div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <Sidebar user={user} onLogout={handleLogout} onNavigate={() => setOpen(false)} />
            <button className="absolute right-3 top-4 rounded-lg p-2 text-white" aria-label="Close sidebar" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}
      <header className="fixed inset-x-0 top-0 z-20 flex h-[78px] items-center justify-between border-b border-slate-100 bg-white px-4 lg:left-60 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div>
            <p className="text-sm font-bold text-navy sm:text-base">Hamburg Ghana SDA Church</p>
            <p className="hidden text-xs text-slate-400 sm:block">Church Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold" />
          </Button>
          <div className="ml-1 hidden h-9 w-px bg-slate-100 sm:block" />
          <div className="ml-2 hidden items-center gap-2 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{initials}</div>
            <div>
              <p className="text-xs font-semibold text-navy">{user.name}</p>
              <p className="text-[11px] text-slate-400">{primaryRole}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="pt-[78px] lg:pl-60">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
