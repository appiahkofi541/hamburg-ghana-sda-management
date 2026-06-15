"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, FileSpreadsheet, Gavel, Plus, Users, Vote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

type MeetingType = "nominating_committee" | "church_election" | "church_board" | "business_meeting";
type VoteMode = "secret_ballot" | "recorded_vote";
type VoteKind = "yes_no_abstain" | "candidate_election";
type VoteStatus = "draft" | "open" | "closed" | "certified";
type Choice = "yes" | "no" | "abstain" | "candidate";
type Member = { id: string; name: string; memberNumber: string };
type Meeting = { id: string; type: MeetingType; title: string; date: string; location: string; quorumRequired: number; quorumPresent: number; agenda: string; minutes: string; status: string };
type Poll = { id: string; meetingId: string; moduleType: MeetingType; kind: VoteKind; mode: VoteMode; title: string; description: string; officeTitle: string; status: VoteStatus; quorumRequired: number; quorumPresent: number };
type Candidate = { id: string; pollId: string; memberId: string; name: string; officeTitle: string };
type Ballot = { id: string; pollId: string; memberId: string; memberName: string; choice: Choice; candidateId: string; comment: string; castAt: string };
type ActionItem = { id: string; meetingId: string; actionItem: string; assignedTo: string; dueDate: string; status: string };
type MeetingAttendance = { id: string; meetingId: string; attendee: string; role: string; present: boolean };
type CommitteeMember = { id: string; memberId: string; name: string; role: string; termYear: number };
type AuditRow = { id: string; action: string; entityType: string; createdAt: string };

const tabs = ["Nominating Committee", "Church Elections", "Board Voting", "Business Meeting Voting", "Meeting Minutes", "Election Results", "Audit Log"] as const;
type Tab = (typeof tabs)[number];
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-churchblue";
const meetingTypeOptions: Array<{ label: string; value: MeetingType }> = [
  { label: "Nominating Committee", value: "nominating_committee" },
  { label: "Church Election", value: "church_election" },
  { label: "Church Board", value: "church_board" },
  { label: "Business Meeting", value: "business_meeting" },
];
const emptyMeeting = { type: "business_meeting" as MeetingType, title: "", date: new Date().toISOString().slice(0, 10), location: "", quorumRequired: "", quorumPresent: "", agenda: "", minutes: "" };
const emptyPoll = { moduleType: "business_meeting" as MeetingType, meetingId: "", kind: "yes_no_abstain" as VoteKind, mode: "recorded_vote" as VoteMode, title: "", description: "", officeTitle: "", quorumRequired: "", candidateMemberId: "" };
const emptyAction = { meetingId: "", actionItem: "", assignedTo: "", dueDate: "", status: "open" };
const emptyAttendance = { meetingId: "", memberId: "", attendeeName: "", role: "", present: true };
const emptyCommittee = { memberId: "", role: "", termYear: new Date().getFullYear() };
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function relatedName(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) return relatedName(value[0]);
  const row = value as { full_name?: unknown; member_number?: unknown; member_id?: unknown };
  return String(row.full_name ?? row.member_number ?? row.member_id ?? "");
}

function downloadExcel(name: string, headers: string[], rows: (string | number)[][]) {
  const esc = (value: string | number) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const html = `<table><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</table>`;
  const url = URL.createObjectURL(new Blob([`<html><head><meta charset="utf-8" /></head><body>${html}</body></html>`], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

async function downloadPdf(name: string, title: string, headers: string[], rows: (string | number)[][]) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait" });
  document.setFontSize(15); document.text(title, 14, 16);
  autoTableModule.default(document, { startY: 24, head: [headers], body: rows, styles: { fontSize: 8 }, headStyles: { fillColor: [8, 41, 76] } });
  document.save(name);
}

export function ChurchGovernance() {
  const [activeTab, setActiveTab] = useState<Tab>("Nominating Committee");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [attendance, setAttendance] = useState<MeetingAttendance[]>([]);
  const [committee, setCommittee] = useState<CommitteeMember[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [meetingForm, setMeetingForm] = useState(emptyMeeting);
  const [pollForm, setPollForm] = useState(emptyPoll);
  const [actionForm, setActionForm] = useState(emptyAction);
  const [attendanceForm, setAttendanceForm] = useState(emptyAttendance);
  const [committeeForm, setCommitteeForm] = useState(emptyCommittee);
  const [voteForm, setVoteForm] = useState({ pollId: "", memberId: "", choice: "yes" as Choice, candidateId: "", comment: "" });
  const [showMeeting, setShowMeeting] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showAction, setShowAction] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [showCommittee, setShowCommittee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = roles.some((role) => ["super_admin", "pastor", "church_clerk", "secretary"].includes(role));
  const eligibleVoters = members;

  async function load() {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let normalized: AppRole[] = [];
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      normalized = normalizeRoles((roleRows ?? []).map(({ role }) => role));
      setRoles(normalized);
      const { data: member } = await supabase.from("members").select("id").eq("profile_id", user.id).eq("status", "active").maybeSingle();
      setCurrentMemberId(member?.id ?? "");
      setVoteForm((current) => ({ ...current, memberId: member?.id ?? current.memberId }));
    }
    const [memberResult, meetingResult, pollResult, candidateResult, ballotResult, actionResult, attendanceResult, committeeResult, auditResult] = await Promise.all([
      supabase.from("members").select("id, full_name, member_number, member_id").eq("status", "active").order("full_name"),
      supabase.from("governance_meetings").select("*").order("meeting_date", { ascending: false }),
      supabase.from("governance_polls").select("*").order("created_at", { ascending: false }),
      supabase.from("governance_candidates").select("*, members(full_name, member_number, member_id)").order("sort_order"),
      supabase.from("governance_ballots").select("*, members(full_name)").order("cast_at", { ascending: false }),
      supabase.from("governance_action_items").select("*").order("created_at", { ascending: false }),
      supabase.from("governance_attendance").select("*, members(full_name)").order("created_at", { ascending: false }),
      supabase.from("governance_committee_members").select("*, members(full_name)").eq("is_active", true).order("term_year", { ascending: false }),
      normalized.some((role) => ["super_admin", "pastor", "church_clerk", "secretary"].includes(role)) ? supabase.from("governance_audit_log").select("*").order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = [memberResult, meetingResult, pollResult, candidateResult, ballotResult, attendanceResult].find((result) => result.error)?.error?.message;
    if (firstError) setError(`${firstError}. Apply migration 202606150001_church_governance_voting.sql in Supabase.`);
    else setError("");
    setMembers((memberResult.data ?? []).map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed Member", memberNumber: row.member_number ?? row.member_id ?? row.id.slice(0, 8) })));
    setMeetings((meetingResult.data ?? []).map((row) => ({ id: row.id, type: row.meeting_type, title: row.title, date: row.meeting_date, location: row.location ?? "", quorumRequired: Number(row.quorum_required), quorumPresent: Number(row.quorum_present), agenda: row.agenda ?? "", minutes: row.minutes ?? "", status: row.status })));
    setPolls((pollResult.data ?? []).map((row) => ({ id: row.id, meetingId: row.meeting_id ?? "", moduleType: row.module_type, kind: row.vote_kind, mode: row.vote_mode, title: row.title, description: row.description ?? "", officeTitle: row.office_title ?? "", status: row.status, quorumRequired: Number(row.quorum_required), quorumPresent: Number(row.quorum_present) })));
    setCandidates((candidateResult.data ?? []).map((row) => ({ id: row.id, pollId: row.poll_id, memberId: row.member_id ?? "", name: row.candidate_name || relatedName(row.members), officeTitle: row.office_title ?? "" })));
    setBallots((ballotResult.data ?? []).map((row) => ({ id: row.id, pollId: row.poll_id, memberId: row.member_id, memberName: relatedName(row.members), choice: row.choice, candidateId: row.candidate_id ?? "", comment: row.comment ?? "", castAt: row.cast_at })));
    setActions((actionResult.data ?? []).map((row) => ({ id: row.id, meetingId: row.meeting_id, actionItem: row.action_item, assignedTo: row.assigned_to ?? "", dueDate: row.due_date ?? "", status: row.status })));
    setAttendance((attendanceResult.data ?? []).map((row) => ({ id: row.id, meetingId: row.meeting_id, attendee: relatedName(row.members) || row.attendee_name || "Attendee", role: row.role ?? "", present: Boolean(row.present) })));
    setCommittee((committeeResult.data ?? []).map((row) => ({ id: row.id, memberId: row.member_id ?? "", name: relatedName(row.members), role: row.role ?? "", termYear: Number(row.term_year) })));
    setAudit((auditResult.data ?? []).map((row) => ({ id: row.id, action: row.action, entityType: row.entity_type, createdAt: row.created_at })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const activePolls = useMemo(() => polls.filter((poll) => poll.status === "open"), [polls]);
  const tabPolls = useMemo(() => {
    const map: Record<Tab, MeetingType | null> = { "Nominating Committee": "nominating_committee", "Church Elections": "church_election", "Board Voting": "church_board", "Business Meeting Voting": "business_meeting", "Meeting Minutes": null, "Election Results": null, "Audit Log": null };
    const type = map[activeTab];
    return type ? polls.filter((poll) => poll.moduleType === type) : polls;
  }, [activeTab, polls]);

  function pollTotals(pollId: string) {
    const rows = ballots.filter((ballot) => ballot.pollId === pollId);
    return {
      total: rows.length,
      yes: rows.filter((row) => row.choice === "yes").length,
      no: rows.filter((row) => row.choice === "no").length,
      abstain: rows.filter((row) => row.choice === "abstain").length,
      candidates: candidates.filter((candidate) => candidate.pollId === pollId).map((candidate) => [candidate.name, rows.filter((row) => row.candidateId === candidate.id).length] as [string, number]),
    };
  }

  async function saveMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const validationError = required(meetingForm.title, "Meeting title") || required(meetingForm.date, "Meeting date");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    const { error: saveError } = supabase ? await supabase.from("governance_meetings").insert({ meeting_type: meetingForm.type, title: meetingForm.title, meeting_date: meetingForm.date, location: meetingForm.location || null, quorum_required: Number(meetingForm.quorumRequired || 0), quorum_present: Number(meetingForm.quorumPresent || 0), agenda: meetingForm.agenda || null, minutes: meetingForm.minutes || null }) : { error: null };
    if (saveError) setError(saveError.message); else { setNotice("Governance meeting saved."); setShowMeeting(false); setMeetingForm(emptyMeeting); await load(); }
    setSaving(false);
  }

  async function savePoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const validationError = required(pollForm.title, "Vote title") || required(pollForm.moduleType, "Module");
    if (validationError) { setError(validationError); return; }
    if (pollForm.kind === "candidate_election" && !pollForm.candidateMemberId) { setError("Select at least one candidate."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data, error: pollError } = await supabase.from("governance_polls").insert({ meeting_id: pollForm.meetingId || null, module_type: pollForm.moduleType, vote_kind: pollForm.kind, vote_mode: pollForm.mode, title: pollForm.title, description: pollForm.description || null, office_title: pollForm.officeTitle || null, quorum_required: Number(pollForm.quorumRequired || 0), status: "open" }).select("id").single();
      if (pollError) { setError(pollError.message); setSaving(false); return; }
      if (pollForm.kind === "candidate_election") {
        const member = members.find((item) => item.id === pollForm.candidateMemberId);
        await supabase.from("governance_candidates").insert({ poll_id: data.id, member_id: pollForm.candidateMemberId, candidate_name: member?.name ?? "Candidate", office_title: pollForm.officeTitle || null });
      }
    }
    setNotice("Vote opened."); setShowPoll(false); setPollForm(emptyPoll); setSaving(false); await load();
  }

  async function castVote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const poll = polls.find((item) => item.id === voteForm.pollId);
    if (!poll || poll.status !== "open") { setError("Select an open vote."); return; }
    const memberId = canManage ? voteForm.memberId : currentMemberId;
    if (!memberId) { setError("Only active members can vote."); return; }
    if (poll.kind === "candidate_election" && !voteForm.candidateId) { setError("Select a candidate."); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true);
    const { error: voteError } = await supabase.from("governance_ballots").insert({ poll_id: poll.id, member_id: memberId, choice: poll.kind === "candidate_election" ? "candidate" : voteForm.choice, candidate_id: poll.kind === "candidate_election" ? voteForm.candidateId : null, comment: voteForm.comment || null });
    if (voteError) setError(voteError.code === "23505" ? "This member has already voted in this item." : voteError.message);
    else { setNotice("Vote recorded."); setVoteForm({ pollId: "", memberId: currentMemberId, choice: "yes", candidateId: "", comment: "" }); await load(); }
    setSaving(false);
  }

  async function saveAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const validationError = required(actionForm.meetingId, "Meeting") || required(actionForm.actionItem, "Action item");
    if (validationError) { setError(validationError); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true);
    const { error: actionError } = await supabase.from("governance_action_items").insert({ meeting_id: actionForm.meetingId, action_item: actionForm.actionItem, assigned_to: actionForm.assignedTo || null, due_date: actionForm.dueDate || null, status: actionForm.status });
    if (actionError) setError(actionError.message); else { setNotice("Action item saved."); setShowAction(false); setActionForm(emptyAction); await load(); }
    setSaving(false);
  }

  async function saveAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const validationError = required(attendanceForm.meetingId, "Meeting") || (!attendanceForm.memberId && !attendanceForm.attendeeName.trim() ? "Select a member or enter attendee name." : "");
    if (validationError) { setError(validationError); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true);
    const { error: attendanceError } = await supabase.from("governance_attendance").insert({
      meeting_id: attendanceForm.meetingId,
      member_id: attendanceForm.memberId || null,
      attendee_name: attendanceForm.attendeeName || null,
      role: attendanceForm.role || null,
      present: attendanceForm.present,
    });
    if (attendanceError) setError(attendanceError.message);
    else { setNotice("Meeting attendance saved."); setShowAttendance(false); setAttendanceForm(emptyAttendance); await load(); }
    setSaving(false);
  }

  async function saveCommittee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const validationError = required(committeeForm.memberId, "Committee member") || required(committeeForm.role, "Role");
    if (validationError) { setError(validationError); return; }
    const supabase = createClient(); if (!supabase) return;
    setSaving(true);
    const { error: committeeError } = await supabase.from("governance_committee_members").insert({ member_id: committeeForm.memberId, role: committeeForm.role, term_year: committeeForm.termYear });
    if (committeeError) setError(committeeError.message); else { setNotice("Committee member added."); setShowCommittee(false); setCommitteeForm(emptyCommittee); await load(); }
    setSaving(false);
  }

  async function closePoll(poll: Poll) {
    if (!canManage) return;
    const supabase = createClient(); if (!supabase) return;
    const { error: closeError } = await supabase.from("governance_polls").update({ status: "closed", quorum_present: pollTotals(poll.id).total }).eq("id", poll.id);
    if (closeError) setError(closeError.message); else { setNotice("Vote closed."); await load(); }
  }

  const reportRows = polls.map((poll) => {
    const totals = pollTotals(poll.id);
    return [poll.title, pretty(poll.moduleType), pretty(poll.kind), pretty(poll.mode), poll.status, totals.total, totals.yes, totals.no, totals.abstain, totals.candidates.map(([name, count]) => `${name}: ${count}`).join("; ")];
  });

  function exportReports(kind: "pdf" | "excel") {
    const headers = ["Title", "Module", "Kind", "Mode", "Status", "Votes", "Yes", "No", "Abstain", "Candidates"];
    if (kind === "excel") downloadExcel("Church-Governance-Reports.xls", headers, reportRows);
    else void downloadPdf("Church-Governance-Reports.pdf", "Church Governance Election Reports", headers, reportRows);
  }

  return <div className="space-y-6">
    <PageHeading title="Church Governance" description="Manage nominating committee work, church elections, board votes, business meeting votes, minutes, action items, and election reports." />
    {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
    <section className="grid gap-4 md:grid-cols-4"><Metric icon={Users} label="Eligible Active Voters" value={eligibleVoters.length} /><Metric icon={Vote} label="Open Votes" value={activePolls.length} /><Metric icon={ClipboardList} label="Meetings" value={meetings.length} /><Metric icon={CheckCircle2} label="Votes Cast" value={ballots.length} /></section>
    <Card className="overflow-hidden"><div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">{tabs.map((tab) => <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab ? "bg-churchblue text-white" : "text-slate-600 hover:bg-slate-50"}`} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</div><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center"><div><h2 className="font-bold text-navy">{activeTab}</h2><p className="mt-1 text-sm text-slate-500">Only active members are eligible voters. Secret ballots hide voter names in reports.</p></div><div className="flex flex-wrap gap-2">{canManage && <Button variant="outline" onClick={() => setShowMeeting(true)}><Plus className="h-4 w-4" /> Add Meeting</Button>}{canManage && <Button onClick={() => setShowPoll(true)}><Vote className="h-4 w-4" /> Open Vote</Button>}{canManage && activeTab === "Nominating Committee" && <Button variant="outline" onClick={() => setShowCommittee(true)}><Users className="h-4 w-4" /> Add Committee Member</Button>}{canManage && activeTab === "Meeting Minutes" && <Button variant="outline" onClick={() => setShowAttendance(true)}><Users className="h-4 w-4" /> Add Attendance</Button>}{canManage && activeTab === "Meeting Minutes" && <Button variant="outline" onClick={() => setShowAction(true)}><ClipboardList className="h-4 w-4" /> Add Action Item</Button>}{activeTab === "Election Results" && <><Button variant="outline" onClick={() => exportReports("pdf")}><Download className="h-4 w-4" /> PDF</Button><Button variant="outline" onClick={() => exportReports("excel")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button></>}</div></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading governance records...</p> : activeTab === "Nominating Committee" ? <CommitteeView committee={committee} polls={tabPolls} /> : activeTab === "Meeting Minutes" ? <MinutesView attendance={attendance} meetings={meetings} actions={actions} /> : activeTab === "Election Results" ? <ReportsView rows={reportRows} /> : activeTab === "Audit Log" ? <AuditView audit={audit} /> : <PollView ballots={ballots} canManage={canManage} candidates={candidates} onClose={closePoll} polls={tabPolls} totals={pollTotals} />}</Card>
    <Card className="p-5"><h2 className="font-bold text-navy">Cast Vote</h2><form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={castVote}><Select label="Open Vote" value={voteForm.pollId} onChange={(value) => setVoteForm({ ...voteForm, pollId: value, candidateId: "" })} options={[["", "Select open vote"], ...activePolls.map((poll) => [poll.id, poll.title] as [string, string])]} />{canManage && <Select label="Voter" value={voteForm.memberId} onChange={(value) => setVoteForm({ ...voteForm, memberId: value })} options={[["", "Select active member"], ...members.map((member) => [member.id, `${member.name} (${member.memberNumber})`] as [string, string])]} />}{polls.find((poll) => poll.id === voteForm.pollId)?.kind === "candidate_election" ? <Select label="Candidate" value={voteForm.candidateId} onChange={(value) => setVoteForm({ ...voteForm, candidateId: value })} options={[["", "Select candidate"], ...candidates.filter((candidate) => candidate.pollId === voteForm.pollId).map((candidate) => [candidate.id, candidate.name] as [string, string])]} /> : <Select label="Vote" value={voteForm.choice} onChange={(value) => setVoteForm({ ...voteForm, choice: value as Choice })} options={[["yes", "Yes"], ["no", "No"], ["abstain", "Abstain"]]} />}<label className="text-sm font-semibold text-slate-700">Comment<input className={fieldClass} value={voteForm.comment} onChange={(event) => setVoteForm({ ...voteForm, comment: event.target.value })} /></label><div className="flex items-end"><Button disabled={saving} type="submit"><Vote className="h-4 w-4" /> Cast Vote</Button></div></form></Card>
    {showMeeting && <MeetingModal form={meetingForm} saving={saving} setForm={setMeetingForm} onClose={() => setShowMeeting(false)} onSubmit={saveMeeting} />}
    {showPoll && <PollModal form={pollForm} meetings={meetings} members={members} saving={saving} setForm={setPollForm} onClose={() => setShowPoll(false)} onSubmit={savePoll} />}
    {showAction && <ActionModal form={actionForm} meetings={meetings} saving={saving} setForm={setActionForm} onClose={() => setShowAction(false)} onSubmit={saveAction} />}
    {showAttendance && <AttendanceModal form={attendanceForm} meetings={meetings} members={members} saving={saving} setForm={setAttendanceForm} onClose={() => setShowAttendance(false)} onSubmit={saveAttendance} />}
    {showCommittee && <CommitteeModal form={committeeForm} members={members} saving={saving} setForm={setCommitteeForm} onClose={() => setShowCommittee(false)} onSubmit={saveCommittee} />}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></div></Card>;
}

function PollView({ polls, candidates, ballots, canManage, onClose, totals }: { polls: Poll[]; candidates: Candidate[]; ballots: Ballot[]; canManage: boolean; onClose: (poll: Poll) => void; totals: (pollId: string) => { total: number; yes: number; no: number; abstain: number; candidates: [string, number][] } }) {
  return <div className="grid gap-4 p-4 lg:grid-cols-2">{polls.map((poll) => { const result = totals(poll.id); return <article className="rounded-xl border border-slate-100 p-5" key={poll.id}><div className="flex items-start justify-between gap-3"><Gavel className="h-6 w-6 text-churchblue" /><StatusBadge tone={poll.status === "open" ? "green" : poll.status === "closed" ? "gold" : "slate"}>{pretty(poll.status)}</StatusBadge></div><h3 className="mt-4 font-bold text-navy">{poll.title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{poll.description || "Governance voting item."}</p><div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><p>Mode: {pretty(poll.mode)}</p><p>Kind: {pretty(poll.kind)}</p><p>Quorum: {result.total}/{poll.quorumRequired || poll.quorumPresent || 0}</p><p>Office: {poll.officeTitle || "-"}</p></div>{poll.kind === "candidate_election" ? <ResultList rows={result.candidates} /> : <ResultList rows={[["Yes", result.yes], ["No", result.no], ["Abstain", result.abstain]]} />}{poll.mode === "recorded_vote" && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{ballots.filter((ballot) => ballot.pollId === poll.id).slice(0, 6).map((ballot) => <p key={ballot.id}>{ballot.memberName}: {ballot.choice === "candidate" ? candidates.find((candidate) => candidate.id === ballot.candidateId)?.name : pretty(ballot.choice)}</p>)}</div>}{canManage && poll.status === "open" && <Button className="mt-4" size="sm" variant="outline" onClick={() => onClose(poll)}>Close Vote</Button>}</article>; })}{polls.length === 0 && <p className="p-8 text-center text-sm text-slate-500 lg:col-span-2">No voting items found.</p>}</div>;
}

function CommitteeView({ committee, polls }: { committee: CommitteeMember[]; polls: Poll[] }) {
  return <div className="grid gap-4 p-4 lg:grid-cols-2"><Table title="Nominating Committee Members" headers={["Member", "Role", "Term"]} rows={committee.map((item) => [item.name, item.role, item.termYear])} /><Table title="Nominating Committee Votes" headers={["Title", "Status", "Mode"]} rows={polls.map((poll) => [poll.title, pretty(poll.status), pretty(poll.mode)])} /></div>;
}

function MinutesView({ meetings, actions, attendance }: { meetings: Meeting[]; actions: ActionItem[]; attendance: MeetingAttendance[] }) {
  const meetingTitle = (meetingId: string) => meetings.find((meeting) => meeting.id === meetingId)?.title ?? "-";
  return <div className="grid gap-4 p-4 xl:grid-cols-2"><Table title="Meeting Minutes" headers={["Date", "Meeting", "Quorum", "Minutes"]} rows={meetings.map((meeting) => [meeting.date, meeting.title, `${meeting.quorumPresent}/${meeting.quorumRequired}`, meeting.minutes || meeting.agenda || "-"])} /><Table title="Meeting Attendance" headers={["Meeting", "Attendee", "Role", "Present"]} rows={attendance.map((item) => [meetingTitle(item.meetingId), item.attendee, item.role || "-", item.present ? "Yes" : "No"])} /><Table title="Action Items" headers={["Action", "Assigned To", "Due", "Status"]} rows={actions.map((action) => [action.actionItem, action.assignedTo || "-", action.dueDate || "-", action.status])} /></div>;
}

function ReportsView({ rows }: { rows: (string | number)[][] }) {
  return <div className="grid gap-4 p-4"><Table title="Election & Voting Results" headers={["Title", "Module", "Kind", "Mode", "Status", "Votes", "Yes", "No", "Abstain", "Candidates"]} rows={rows} /></div>;
}

function AuditView({ audit }: { audit: AuditRow[] }) {
  return <div className="grid gap-4 p-4"><Table title="Governance Audit Trail" headers={["When", "Action", "Entity"]} rows={audit.map((row) => [row.createdAt.slice(0, 16).replace("T", " "), pretty(row.action), row.entityType])} /></div>;
}

function ResultList({ rows }: { rows: [string, number][] }) {
  return <div className="mt-4 space-y-2">{rows.map(([label, value]) => <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm" key={label}><span className="font-semibold text-slate-600">{label}</span><span className="font-bold text-navy">{value}</span></div>)}</div>;
}

function Table({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return <div className="overflow-hidden rounded-xl border border-slate-100"><h3 className="border-b border-slate-100 bg-white px-4 py-3 font-bold text-navy">{title}</h3><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">{headers.map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-slate-100" key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td className="px-4 py-3 text-slate-600" key={`${title}-${index}-${cellIndex}`}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={headers.length}>No records found.</td></tr>}</tbody></table></div></div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option key={`${label}-${optionValue}`} value={optionValue}>{text}</option>)}</select></label>;
}

function MeetingModal({ form, saving, setForm, onClose, onSubmit }: { form: typeof emptyMeeting; saving: boolean; setForm: (form: typeof emptyMeeting) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add Governance Meeting" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Select label="Meeting Type" value={form.type} onChange={(value) => setForm({ ...form, type: value as MeetingType })} options={meetingTypeOptions.map((option) => [option.value, option.label])} /><label className="text-sm font-semibold text-slate-700">Date<input className={fieldClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Title<input className={fieldClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Location<input className={fieldClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Quorum Required<input className={fieldClass} min="0" type="number" value={form.quorumRequired} onChange={(event) => setForm({ ...form, quorumRequired: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Quorum Present<input className={fieldClass} min="0" type="number" value={form.quorumPresent} onChange={(event) => setForm({ ...form, quorumPresent: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Agenda<textarea className={textareaClass} value={form.agenda} onChange={(event) => setForm({ ...form, agenda: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Minutes<textarea className={textareaClass} value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} /></label></div></Modal>;
}

function PollModal({ form, meetings, members, saving, setForm, onClose, onSubmit }: { form: typeof emptyPoll; meetings: Meeting[]; members: Member[]; saving: boolean; setForm: (form: typeof emptyPoll) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Open Governance Vote" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Select label="Module" value={form.moduleType} onChange={(value) => setForm({ ...form, moduleType: value as MeetingType })} options={meetingTypeOptions.map((option) => [option.value, option.label])} /><Select label="Meeting" value={form.meetingId} onChange={(value) => setForm({ ...form, meetingId: value })} options={[["", "No meeting linked"], ...meetings.map((meeting) => [meeting.id, meeting.title] as [string, string])]} /><Select label="Vote Kind" value={form.kind} onChange={(value) => setForm({ ...form, kind: value as VoteKind })} options={[["yes_no_abstain", "Yes / No / Abstain"], ["candidate_election", "Candidate Election"]]} /><Select label="Vote Mode" value={form.mode} onChange={(value) => setForm({ ...form, mode: value as VoteMode })} options={[["secret_ballot", "Secret Ballot"], ["recorded_vote", "Recorded Vote"]]} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Title<input className={fieldClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Church Office<input className={fieldClass} value={form.officeTitle} onChange={(event) => setForm({ ...form, officeTitle: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Quorum Required<input className={fieldClass} min="0" type="number" value={form.quorumRequired} onChange={(event) => setForm({ ...form, quorumRequired: event.target.value })} /></label>{form.kind === "candidate_election" && <Select label="Candidate" value={form.candidateMemberId} onChange={(value) => setForm({ ...form, candidateMemberId: value })} options={[["", "Select active member"], ...members.map((member) => [member.id, member.name] as [string, string])]} />}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div></Modal>;
}

function ActionModal({ form, meetings, saving, setForm, onClose, onSubmit }: { form: typeof emptyAction; meetings: Meeting[]; saving: boolean; setForm: (form: typeof emptyAction) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add Action Item" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Select label="Meeting" value={form.meetingId} onChange={(value) => setForm({ ...form, meetingId: value })} options={[["", "Select meeting"], ...meetings.map((meeting) => [meeting.id, meeting.title] as [string, string])]} /><label className="text-sm font-semibold text-slate-700">Due Date<input className={fieldClass} type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Action Item<input className={fieldClass} value={form.actionItem} onChange={(event) => setForm({ ...form, actionItem: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Assigned To<input className={fieldClass} value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Status<input className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></label></div></Modal>;
}

function AttendanceModal({ form, meetings, members, saving, setForm, onClose, onSubmit }: { form: typeof emptyAttendance; meetings: Meeting[]; members: Member[]; saving: boolean; setForm: (form: typeof emptyAttendance) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add Meeting Attendance" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Select label="Meeting" value={form.meetingId} onChange={(value) => setForm({ ...form, meetingId: value })} options={[["", "Select meeting"], ...meetings.map((meeting) => [meeting.id, meeting.title] as [string, string])]} /><Select label="Member" value={form.memberId} onChange={(value) => setForm({ ...form, memberId: value, attendeeName: "" })} options={[["", "Visitor / manual attendee"], ...members.map((member) => [member.id, `${member.name} (${member.memberNumber})`] as [string, string])]} /><label className="text-sm font-semibold text-slate-700">Manual Attendee Name<input className={fieldClass} value={form.attendeeName} onChange={(event) => setForm({ ...form, attendeeName: event.target.value, memberId: "" })} /></label><label className="text-sm font-semibold text-slate-700">Role<input className={fieldClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><input checked={form.present} type="checkbox" onChange={(event) => setForm({ ...form, present: event.target.checked })} /> Present</label></div></Modal>;
}

function CommitteeModal({ form, members, saving, setForm, onClose, onSubmit }: { form: typeof emptyCommittee; members: Member[]; saving: boolean; setForm: (form: typeof emptyCommittee) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Add Nominating Committee Member" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Select label="Member" value={form.memberId} onChange={(value) => setForm({ ...form, memberId: value })} options={[["", "Select active member"], ...members.map((member) => [member.id, member.name] as [string, string])]} /><label className="text-sm font-semibold text-slate-700">Term Year<input className={fieldClass} type="number" value={form.termYear} onChange={(event) => setForm({ ...form, termYear: Number(event.target.value) })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Role<input className={fieldClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label></div></Modal>;
}

function Modal({ title, children, saving, onClose, onSubmit }: { title: string; children: React.ReactNode; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church governance records</p></div><Button type="button" variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</Button></div></form></div>;
}
