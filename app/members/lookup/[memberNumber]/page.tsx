import { CheckCircle2, IdCard, UsersRound, XCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { getSupabasePublicKey } from "@/lib/auth";

type MemberLookupPayload = {
  member: {
    member_number: string;
    full_name: string;
    status: string;
    department: string;
  };
  church: {
    church_name: string;
    short_name: string;
  };
};

export const dynamic = "force-dynamic";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  return status === "active" ? "green" : "slate";
}

export default async function MemberLookupPage({ params }: { params: Promise<{ memberNumber: string }> }) {
  const { memberNumber } = await params;
  const decodedMemberNumber = decodeURIComponent(memberNumber);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabasePublicKey();

  if (!url || !key) {
    return <LookupShell><EmptyState title="Member lookup is not configured" message="Supabase public project credentials are required to verify member ID cards." /></LookupShell>;
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.rpc("get_public_member_lookup", { member_number_input: decodedMemberNumber });
  const lookup = data as MemberLookupPayload | null;

  if (error) {
    return <LookupShell><EmptyState title="Member lookup is not ready" message="Run migration 202606120008_public_member_lookup_rpc.sql in Supabase SQL Editor, then scan the QR code again." /></LookupShell>;
  }

  if (!lookup?.member) {
    return <LookupShell><EmptyState title="Member not found" message={`No public membership verification record was found for ${decodedMemberNumber}.`} /></LookupShell>;
  }

  const { member, church } = lookup;
  const active = member.status === "active";

  return (
    <LookupShell>
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="bg-navy-deep p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">{church.church_name}</p>
          <h1 className="mt-3 text-2xl font-bold">Member Verification</h1>
          <p className="mt-2 text-sm text-blue-100">Public ID card lookup</p>
        </div>
        <div className="p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Member Name</p>
              <h2 className="mt-1 text-2xl font-bold text-navy">{member.full_name}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{member.member_number}</p>
            </div>
            <StatusBadge tone={statusTone(member.status)}>{titleCase(member.status)}</StatusBadge>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info icon={IdCard} label="Member Number" value={member.member_number} />
            <Info icon={UsersRound} label="Department" value={member.department || "Not assigned"} />
            <Info icon={active ? CheckCircle2 : XCircle} label="Membership Status" value={active ? "Active member" : "Inactive member"} />
            <Info icon={IdCard} label="Church" value={church.church_name} />
          </div>
        </div>
      </Card>
    </LookupShell>
  );
}

function LookupShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl space-y-6">{children}</div></main>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <Card className="mx-auto max-w-2xl p-8 text-center"><h1 className="text-2xl font-bold text-navy">{title}</h1><p className="mt-3 text-sm text-slate-500">{message}</p></Card>;
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-white p-4"><Icon className="h-5 w-5 text-churchblue" /><p className="mt-3 text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>;
}
