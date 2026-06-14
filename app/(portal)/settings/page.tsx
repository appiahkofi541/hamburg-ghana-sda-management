import Link from "next/link";
import { BellRing, LockKeyhole, Settings2, ShieldCheck, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { RecordSettingsManagement } from "@/components/record-settings-management";

const settings = [
  { title: "Church Profile", body: "Update church details, address, and contact information.", icon: Settings2, href: "/church-profile", action: "Open Church Profile" },
  { title: "Notifications", body: "Configure email and announcement delivery preferences.", icon: BellRing, href: "#notification-settings", action: "View Status" },
  { title: "Security", body: "Review password policies and account security settings.", icon: LockKeyhole, href: "#account-password", action: "Open Security" },
  { title: "Permissions", body: "Manage role-based access across the application.", icon: ShieldCheck, href: "/users", action: "Manage Access" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Settings" description="Configure your church management system." />
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map(({ title, body, icon: Icon, href, action }) => (
          <Link className="group block rounded-xl focus:outline-none focus:ring-2 focus:ring-churchblue focus:ring-offset-2" href={href} key={title}>
            <Card className="flex h-full items-start gap-4 p-5 transition-colors group-hover:border-churchblue/40 group-hover:bg-blue-50/40">
              <div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div>
              <div>
                <h2 className="font-bold text-navy">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
                <p className="mt-4 text-sm font-bold text-churchblue">{action}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" id="notification-settings">
        <div className="flex gap-4"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><BellRing className="h-5 w-5" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-navy">Notification Settings</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Coming Soon</span></div><p className="mt-1 text-sm text-slate-500">Centralized notification preferences for email, announcements, WhatsApp, and SMS are not built yet.</p></div></div>
        <Link href="/communications"><Button variant="outline">Open Communications</Button></Link>
      </Card>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" id="permissions">
        <div className="flex gap-4"><div className="rounded-lg bg-amber-50 p-3 text-amber-700"><UserRoundCog className="h-5 w-5" /></div><div><h2 className="font-bold text-navy">User Access Management</h2><p className="mt-1 text-sm text-slate-500">Invite users and manage access roles.</p></div></div>
        <Link href="/users"><Button variant="outline">Manage Users</Button></Link>
      </Card>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center" id="account-password">
        <div><h2 className="font-bold text-navy">Account Password</h2><p className="mt-1 text-sm text-slate-500">Update the password for your signed-in account.</p></div>
        <Link href="/change-password"><Button variant="outline">Change Password</Button></Link>
      </Card>
      <RecordSettingsManagement />
    </div>
  );
}
