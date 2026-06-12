import { Archive, CalendarClock, ClipboardCheck, MapPin } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { getSupabasePublicKey } from "@/lib/auth";

type AssetStatus = "available" | "assigned" | "in_use" | "under_maintenance" | "retired" | "lost";
type AssignmentRow = {
  id: string;
  assigned_to_type: string;
  assigned_to_name: string | null;
  assigned_role: string | null;
  assigned_location: string | null;
  checked_out_at: string | null;
  checked_in_at: string | null;
  expected_return_date: string | null;
  condition_out: string | null;
  condition_in: string | null;
  notes: string | null;
};
type AssetLookupPayload = {
  asset: {
    id: string;
    asset_number: string;
    name: string;
    description: string | null;
    serial_number: string | null;
    purchase_date: string | null;
    current_value: number | string | null;
    location: string | null;
    status: AssetStatus;
    notes: string | null;
    category_name: string | null;
  };
  currentAssignment: AssignmentRow | null;
  assignmentHistory: AssignmentRow[];
};

export const dynamic = "force-dynamic";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "available" || status === "completed") return "green";
  if (status === "assigned" || status === "in_use" || status === "scheduled") return "blue";
  if (status === "under_maintenance" || status === "in_progress") return "gold";
  if (status === "lost") return "red";
  return "slate";
}

function formatDateTime(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

export default async function AssetLookupPage({ params }: { params: Promise<{ assetNumber: string }> }) {
  const { assetNumber } = await params;
  const decodedAssetNumber = decodeURIComponent(assetNumber);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabasePublicKey();

  if (!url || !key) {
    return <LookupShell><EmptyState title="Asset lookup is not configured" message="Supabase public project credentials are required to view asset QR lookup pages." /></LookupShell>;
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.rpc("get_public_asset_lookup", { asset_number_input: decodedAssetNumber });
  const lookup = data as AssetLookupPayload | null;

  if (error) {
    return <LookupShell><EmptyState title="Asset lookup is not ready" message="Run migration 202606120005_public_asset_lookup_rpc.sql in Supabase SQL Editor, then scan the QR code again." /></LookupShell>;
  }

  if (!lookup?.asset) {
    return <LookupShell><EmptyState title="Asset not found" message={`No asset record was found for ${decodedAssetNumber}.`} /></LookupShell>;
  }

  const { asset, currentAssignment } = lookup;
  const assignmentRows = lookup.assignmentHistory ?? [];

  return (
    <LookupShell>
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-churchblue">Hamburg Ghana SDA Church</p>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-bold text-navy">{asset.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{asset.asset_number} · {asset.category_name ?? "Uncategorized"}</p>
            </div>
            <StatusBadge tone={statusTone(asset.status)}>{titleCase(asset.status as AssetStatus)}</StatusBadge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info icon={MapPin} label="Location" value={asset.location ?? "-"} />
            <Info icon={Archive} label="Serial Number" value={asset.serial_number ?? "-"} />
            <Info icon={ClipboardCheck} label="Condition / Notes" value={asset.notes ?? "No notes recorded."} />
            <Info icon={CalendarClock} label="Purchase Date" value={asset.purchase_date ?? "-"} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold text-navy">Asset Details</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Detail label="Asset ID" value={asset.asset_number} />
            <Detail label="Category" value={asset.category_name ?? "Uncategorized"} />
            <Detail label="Status" value={titleCase(asset.status as string)} />
            <Detail label="Current Value" value={`EUR ${Number(asset.current_value ?? 0).toLocaleString("de-DE")}`} />
            <Detail label="Current Assignment" value={currentAssignment?.assigned_to_name ?? "No active assignment"} />
            <Detail label="Description" value={asset.description ?? "No description recorded."} />
          </div>
        </Card>
      </section>

      <Card>
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-navy">Assignment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                {["Assigned To", "Type", "Checked Out", "Expected Return", "Checked In", "Condition", "Notes"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {assignmentRows.map((assignment) => (
                <tr className="border-t border-slate-100" key={assignment.id}>
                  <td className="px-5 py-4 font-semibold text-navy">{assignment.assigned_to_name ?? titleCase(assignment.assigned_to_type)}</td>
                  <td className="px-5 py-4 text-slate-600">{titleCase(assignment.assigned_to_type)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(assignment.checked_out_at)}</td>
                  <td className="px-5 py-4 text-slate-600">{assignment.expected_return_date ?? "-"}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(assignment.checked_in_at)}</td>
                  <td className="px-5 py-4 text-slate-600">{assignment.condition_in || assignment.condition_out || "-"}</td>
                  <td className="px-5 py-4 text-slate-600">{assignment.notes ?? "-"}</td>
                </tr>
              ))}
              {assignmentRows.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={7}>No assignment history recorded for this asset.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </LookupShell>
  );
}

function LookupShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl space-y-6">{children}</div></main>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <Card className="p-8 text-center"><h1 className="text-2xl font-bold text-navy">{title}</h1><p className="mt-3 text-sm text-slate-500">{message}</p></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-100 pb-3"><span className="font-semibold text-slate-500">{label}</span><span className="max-w-[60%] text-right font-semibold text-navy">{value}</span></div>;
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="rounded-lg border border-slate-100 bg-white p-4"><Icon className="h-5 w-5 text-churchblue" /><p className="mt-3 text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>;
}
