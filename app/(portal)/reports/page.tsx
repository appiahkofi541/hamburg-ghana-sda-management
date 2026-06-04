import { ChartNoAxesCombined, CircleDollarSign, ClipboardCheck, Download, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";

const reports = [
  ["Membership Report", "Member directory, growth, and department distribution.", Users, "Updated today"],
  ["Attendance Summary", "Weekly attendance trends and visitor activity.", ClipboardCheck, "Updated yesterday"],
  ["Giving Statement", "Tithe, offering, and building fund summaries.", CircleDollarSign, "Updated today"],
  ["Ministry Overview", "Department engagement and ministry participation.", ChartNoAxesCombined, "Updated May 28"],
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Reports" description="Generate and export church administration reports." />
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map(([title, body, Icon, update]) => (
          <Card className="p-5" key={String(title)}>
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div>
              <Button variant="outline" size="sm" disabled><Download className="h-4 w-4" /> Coming Soon</Button>
            </div>
            <h2 className="mt-5 font-bold text-navy">{String(title)}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{String(body)}</p>
            <p className="mt-4 text-xs text-slate-400">{String(update)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
