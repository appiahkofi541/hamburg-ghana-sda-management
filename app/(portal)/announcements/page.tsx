import { Megaphone, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { announcements } from "@/lib/data";

export default function AnnouncementsPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Announcements" description="Publish updates and keep the church family informed." />
      <div className="space-y-4">
        {announcements.map((announcement, index) => (
          <Card className="p-5" key={announcement.title}>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">{index === 0 ? <Pin className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}</div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-bold text-navy">{announcement.title}</h2><p className="mt-1 text-xs text-slate-400">{announcement.date} · {announcement.author}</p></div>
                  <StatusBadge tone="blue">{announcement.audience}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{announcement.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
