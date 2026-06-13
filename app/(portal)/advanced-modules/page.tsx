"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BadgeEuro,
  MessageCircle,
  RadioTower,
  Send,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { hasAllowedRole, normalizeRoles, type AppRole } from "@/lib/auth";

type ModuleStatus = "Live" | "Coming Soon";
type AdvancedModule = {
  name: string;
  description: string;
  technology: string;
  icon: LucideIcon;
  tone: string;
  status: ModuleStatus;
  href?: string;
  allowedRoles?: AppRole[];
};

const modules: AdvancedModule[] = [
  {
    name: "Mobile App",
    description: "Give members a convenient mobile home for church updates, events, giving, and ministry resources.",
    technology: "React Native with Expo",
    icon: Smartphone,
    tone: "bg-blue-50 text-churchblue",
    status: "Coming Soon",
  },
  {
    name: "SMS Notifications",
    description: "Send timely service reminders, event notices, and pastoral updates directly to member phones.",
    technology: "Twilio SMS API",
    icon: Send,
    tone: "bg-emerald-50 text-emerald-700",
    status: "Coming Soon",
  },
  {
    name: "WhatsApp Notifications",
    description: "Share important announcements and ministry updates through a familiar messaging channel.",
    technology: "WhatsApp Business Cloud API",
    icon: MessageCircle,
    tone: "bg-green-50 text-green-700",
    status: "Live",
    href: "/whatsapp",
    allowedRoles: ["super_admin", "pastor", "elder", "church_clerk", "secretary"],
  },
  {
    name: "Online Tithe Payment",
    description: "Enable secure digital giving for tithe, offerings, missions, and special church funds.",
    technology: "Stripe Payments with Supabase",
    icon: BadgeEuro,
    tone: "bg-amber-50 text-amber-700",
    status: "Coming Soon",
  },
  {
    name: "Livestream Integration",
    description: "Bring Sabbath services and special programs to members who cannot attend in person.",
    technology: "YouTube Live API",
    icon: RadioTower,
    tone: "bg-rose-50 text-rose-700",
    status: "Live",
    href: "/livestream",
    allowedRoles: ["super_admin", "pastor", "elder", "church_clerk", "secretary", "treasurer", "department_head", "member"],
  },
  {
    name: "Sermon Archive",
    description: "Create a searchable library of sermons, Bible studies, and worship recordings.",
    technology: "Supabase Storage with PostgreSQL",
    icon: Archive,
    tone: "bg-purple-50 text-purple-700",
    status: "Live",
    href: "/sermons",
    allowedRoles: ["super_admin", "pastor", "elder", "church_clerk", "secretary", "treasurer", "department_head", "member"],
  },
];

export default function AdvancedModulesPage() {
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    async function loadRoles() {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles(normalizeRoles((data ?? []).map(({ role }) => role)));
    }
    loadRoles();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Advanced Modules"
        description="Current status of extended digital ministry modules for Hamburg Ghana SDA Church."
      />
      <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-navy to-churchblue px-5 py-6 text-white shadow-card sm:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Module Status</p>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">Working tools and planned integrations</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
          Live modules open the working page for authorized users. Planned or partially configured integrations remain marked as coming soon.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ name, description, technology, icon: Icon, tone, status, href, allowedRoles }) => {
          const canOpen = status === "Live" && href && (!allowedRoles || hasAllowedRole(roles, allowedRoles));
          return (
          <Card className="flex min-h-64 flex-col p-5" key={name}>
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <StatusBadge tone={status === "Live" ? "green" : "gold"}>{status}</StatusBadge>
            </div>
            <h2 className="mt-5 font-bold text-navy">{name}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended Technology</p>
              <p className="mt-1 text-sm font-semibold text-churchblue">{technology}</p>
            </div>
            <div className="mt-4 min-h-10">
              {canOpen ? <Link className="inline-flex h-9 items-center justify-center rounded-lg bg-churchblue px-3 text-sm font-semibold text-white transition-colors hover:bg-navy" href={href}>Open Module</Link> : status === "Live" ? <p className="text-xs font-semibold text-slate-400">Available to authorized roles</p> : <p className="text-xs font-semibold text-slate-400">Planned module</p>}
            </div>
          </Card>
          );
        })}
      </section>
    </div>
  );
}
