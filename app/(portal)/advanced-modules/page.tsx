import {
  Archive,
  BadgeEuro,
  BellRing,
  MessageCircle,
  RadioTower,
  Send,
  Smartphone,
  Vote,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";

const modules = [
  {
    name: "Mobile App",
    description: "Give members a convenient mobile home for church updates, events, giving, and ministry resources.",
    technology: "React Native with Expo",
    icon: Smartphone,
    tone: "bg-blue-50 text-churchblue",
  },
  {
    name: "SMS Notifications",
    description: "Send timely service reminders, event notices, and pastoral updates directly to member phones.",
    technology: "Twilio SMS API",
    icon: Send,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "WhatsApp Notifications",
    description: "Share important announcements and ministry updates through a familiar messaging channel.",
    technology: "WhatsApp Business Cloud API",
    icon: MessageCircle,
    tone: "bg-green-50 text-green-700",
    status: "Live",
  },
  {
    name: "Online Tithe Payment",
    description: "Enable secure digital giving for tithe, offerings, missions, and special church funds.",
    technology: "Stripe Payments with Supabase",
    icon: BadgeEuro,
    tone: "bg-amber-50 text-amber-700",
    status: "Live",
  },
  {
    name: "Livestream Integration",
    description: "Bring Sabbath services and special programs to members who cannot attend in person.",
    technology: "YouTube Live API",
    icon: RadioTower,
    tone: "bg-rose-50 text-rose-700",
    status: "Live",
  },
  {
    name: "Sermon Archive",
    description: "Create a searchable library of sermons, Bible studies, and worship recordings.",
    technology: "Supabase Storage with PostgreSQL",
    icon: Archive,
    tone: "bg-purple-50 text-purple-700",
    status: "Live",
  },
  {
    name: "Prayer Request Portal",
    description: "Offer a private, caring space for members to submit prayer needs and request follow-up.",
    technology: "Next.js Forms with Supabase RLS",
    icon: BellRing,
    tone: "bg-cyan-50 text-cyan-700",
    status: "Live",
  },
  {
    name: "Church Voting System",
    description: "Support transparent member voting for church decisions with secure eligibility controls.",
    technology: "Supabase Auth with PostgreSQL",
    icon: Vote,
    tone: "bg-indigo-50 text-indigo-700",
  },
];

export default function AdvancedModulesPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Advanced Modules"
        description="Future expansion roadmap for Hamburg Ghana SDA Church."
      />
      <section className="rounded-xl border border-blue-100 bg-gradient-to-r from-navy to-churchblue px-5 py-6 text-white shadow-card sm:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Growth Roadmap</p>
        <h2 className="mt-3 text-xl font-bold sm:text-2xl">Building the next chapter of digital ministry</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
          These planned modules will extend the Hamburg Ghana SDA Church Management System as the needs of our church family grow.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ name, description, technology, icon: Icon, tone, status = "Coming Soon" }) => (
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
          </Card>
        ))}
      </section>
    </div>
  );
}
