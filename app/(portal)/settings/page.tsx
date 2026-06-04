import Link from "next/link";
import { BellRing, LockKeyhole, Settings2, ShieldCheck, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

const settings = [
  ["Church Profile", "Update church details, address, and contact information.", Settings2],
  ["Notifications", "Configure email and announcement delivery preferences.", BellRing],
  ["Security", "Review password policies and account security settings.", LockKeyhole],
  ["Permissions", "Manage role-based access across the application.", ShieldCheck],
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Settings" description="Configure your church management system." />
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map(([title, body, Icon]) => (
          <Card className="flex items-start gap-4 p-5" key={String(title)}>
            <div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div>
            <div><h2 className="font-bold text-navy">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{String(body)}</p></div>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex gap-4"><div className="rounded-lg bg-amber-50 p-3 text-amber-700"><UserRoundCog className="h-5 w-5" /></div><div><h2 className="font-bold text-navy">User Access Management</h2><p className="mt-1 text-sm text-slate-500">Invite users and manage access roles.</p></div></div>
        <Link href="/users"><Button variant="outline">Manage Users</Button></Link>
      </Card>
      <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div><h2 className="font-bold text-navy">Account Password</h2><p className="mt-1 text-sm text-slate-500">Update the password for your signed-in account.</p></div>
        <Link href="/change-password"><Button variant="outline">Change Password</Button></Link>
      </Card>
    </div>
  );
}
