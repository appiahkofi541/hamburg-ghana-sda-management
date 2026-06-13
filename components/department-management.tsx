"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, BadgeEuro, Download, FileSpreadsheet, Pencil, Plus, Search,
  Target, ToggleLeft, ToggleRight, TrendingUp, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type DepartmentRecord } from "@/lib/types";
import { normalizeRoles, type AppRole } from "@/lib/auth";
import { required } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";

const storageKey = "hamburg-ghana-sda-departments";
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue";
const seedRecords: DepartmentRecord[] = [];
const emptyRecord: DepartmentRecord = { id: "", name: "", description: "", leader: "", meetingSchedule: "", memberCount: 0, isActive: true, createdAt: "" };
const budgetStatuses = ["draft", "approved", "active", "over_budget", "closed"] as const;
const performanceStatuses = ["excellent", "good", "needs_attention", "at_risk"] as const;
const expenseCategories = ["Program", "Supplies", "Transport", "Welfare", "Training", "Outreach", "Equipment", "Other"];
const tabs = ["Departments", "Budget", "Expenses", "Performance", "Reports"] as const;
const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

type DepartmentTab = (typeof tabs)[number];
type LeaderOption = { id: string; name: string; email: string };
type BudgetStatus = (typeof budgetStatuses)[number];
type PerformanceStatus = (typeof performanceStatuses)[number];
type DepartmentBudget = { id: string; departmentId: string; departmentName: string; budgetYear: number; approvedBudget: number; amountSpent: number; remainingBalance: number; status: BudgetStatus; notes: string };
type DepartmentExpense = { id: string; departmentId: string; departmentName: string; expenseDate: string; category: string; description: string; amount: number; recordedBy: string; receiptReference: string };
type DepartmentPerformance = { id: string; departmentId: string; departmentName: string; periodStart: string; periodEnd: string; plannedActivities: number; completedActivities: number; attendanceCount: number; visitorEngagement: number; membersInvolved: number; goalsAchieved: string; status: PerformanceStatus; notes: string };

const emptyBudget = { departmentId: "", budgetYear: new Date().getFullYear(), approvedBudget: "", status: "draft" as BudgetStatus, notes: "" };
const emptyExpense = { departmentId: "", expenseDate: new Date().toISOString().slice(0, 10), category: "Program", description: "", amount: "", receiptReference: "" };
const emptyPerformance = { departmentId: "", periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10), plannedActivities: "", completedActivities: "", attendanceCount: "", visitorEngagement: "", membersInvolved: "", goalsAchieved: "", status: "good" as PerformanceStatus, notes: "" };

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function profileName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return profileName(value[0]);
  const profile = value as { full_name?: unknown; email?: unknown; name?: unknown };
  return String(profile.full_name ?? profile.name ?? profile.email ?? "");
}

function relatedDepartment(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return relatedDepartment(value[0]);
  return String((value as { name?: unknown }).name ?? "");
}

function statusTone(status: string) {
  if (["approved", "active", "excellent", "good"].includes(status)) return "green" as const;
  if (["over_budget", "at_risk"].includes(status)) return "red" as const;
  if (["draft", "needs_attention"].includes(status)) return "gold" as const;
  return "slate" as const;
}

function downloadWorkbook(name: string, worksheet: string, headers: string[], rows: (string | number)[][], titleRows: string[][] = []) {
  const escapeCell = (value: string | number) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const tableRows = [...titleRows.map((row) => `<tr>${row.map((cell) => `<th colspan="${headers.length}">${escapeCell(cell)}</th>`).join("")}</tr>`), `<tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join("")}</tr>`, ...rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeCell(cell)}</td>`).join("")}</tr>`)].join("");
  const blob = new Blob([`<html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function DepartmentManagement() {
  const [activeTab, setActiveTab] = useState<DepartmentTab>("Departments");
  const [records, setRecords] = useState<DepartmentRecord[]>([]);
  const [leaders, setLeaders] = useState<LeaderOption[]>([]);
  const [budgets, setBudgets] = useState<DepartmentBudget[]>([]);
  const [expenses, setExpenses] = useState<DepartmentExpense[]>([]);
  const [performance, setPerformance] = useState<DepartmentPerformance[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyRecord);
  const [budgetForm, setBudgetForm] = useState(emptyBudget);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [performanceForm, setPerformanceForm] = useState(emptyPerformance);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [editingBudget, setEditingBudget] = useState<DepartmentBudget | null>(null);
  const [editingExpense, setEditingExpense] = useState<DepartmentExpense | null>(null);
  const [editingPerformance, setEditingPerformance] = useState<DepartmentPerformance | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPerformanceForm, setShowPerformanceForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [canManageAll, setCanManageAll] = useState(!createClient());

  const canManageBudgets = roles.some((role) => role === "super_admin" || role === "treasurer");
  const canSubmitDepartmentUpdates = roles.some((role) => role === "super_admin" || role === "treasurer" || role === "department_head");
  const canViewReports = roles.some((role) => ["super_admin", "treasurer", "pastor", "secretary", "department_head"].includes(role));
  const departmentOptions = useMemo(() => records.filter((record) => canManageBudgets || record.leaderId === userId), [canManageBudgets, records, userId]);

  async function load() {
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      let roleNames: AppRole[] = [];
      if (user) {
        setUserId(user.id);
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        roleNames = normalizeRoles((roleRows ?? []).map(({ role }) => role));
        setRoles(roleNames);
        setCanManageAll(roleNames.some((role) => ["super_admin", "pastor", "church_clerk", "secretary"].includes(role)));
      }
      const [departmentResult, profileResult, membershipResult, budgetResult, expenseResult, performanceResult] = await Promise.all([
        supabase.from("departments").select("*, leader:profiles!departments_leader_id_fkey(full_name, email)").order("name"),
        supabase.from("profiles").select("id, full_name, email, user_roles(role)").eq("is_active", true).order("full_name"),
        supabase.from("department_members").select("department_id"),
        supabase.from("department_budgets").select("*, departments(name)").order("budget_year", { ascending: false }),
        supabase.from("department_expenses").select("*, departments(name), recorded_by_profile:profiles!department_expenses_recorded_by_fkey(full_name, email)").order("expense_date", { ascending: false }),
        supabase.from("department_performance").select("*, departments(name)").order("period_end", { ascending: false }),
      ]);
      if (departmentResult.error) setError(departmentResult.error.message);
      if (budgetResult.error && !budgetResult.error.message.includes("department_budgets")) setError(budgetResult.error.message);
      setLeaders((profileResult.data ?? []).map((profile) => ({ id: profile.id, name: profile.full_name ?? profile.email ?? "Unnamed user", email: profile.email ?? "" })));
      const memberCounts = new Map<string, number>();
      (membershipResult.data ?? []).forEach((membership) => memberCounts.set(membership.department_id, (memberCounts.get(membership.department_id) ?? 0) + 1));
      if (departmentResult.data?.length) {
        setRecords(departmentResult.data.map((row) => ({ id: row.id, name: row.name, description: row.description ?? "", leader: profileName(row.leader), leaderId: row.leader_id ?? "", meetingSchedule: row.meeting_schedule ?? "", memberCount: memberCounts.get(row.id) ?? 0, isActive: row.is_active, createdAt: row.created_at?.slice(0, 10) ?? "" })));
      }
      setBudgets((budgetResult.data ?? []).map((row) => ({ id: row.id, departmentId: row.department_id, departmentName: relatedDepartment(row.departments), budgetYear: row.budget_year, approvedBudget: Number(row.approved_budget_amount), amountSpent: Number(row.amount_spent), remainingBalance: Number(row.remaining_balance), status: row.budget_status, notes: row.notes ?? "" })));
      setExpenses((expenseResult.data ?? []).map((row) => ({ id: row.id, departmentId: row.department_id, departmentName: relatedDepartment(row.departments), expenseDate: row.expense_date, category: row.category, description: row.description, amount: Number(row.amount), recordedBy: profileName(row.recorded_by_profile) || "Not recorded", receiptReference: row.receipt_reference ?? "" })));
      setPerformance((performanceResult.data ?? []).map((row) => ({ id: row.id, departmentId: row.department_id, departmentName: relatedDepartment(row.departments), periodStart: row.period_start, periodEnd: row.period_end, plannedActivities: Number(row.planned_activities), completedActivities: Number(row.completed_activities), attendanceCount: Number(row.attendance_count), visitorEngagement: Number(row.visitor_engagement), membersInvolved: Number(row.members_involved), goalsAchieved: row.goals_achieved ?? "", status: row.performance_status, notes: row.notes ?? "" })));
      setLoading(false);
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    setRecords(stored ? JSON.parse(stored) : seedRecords);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (!createClient() && records.length) window.localStorage.setItem(storageKey, JSON.stringify(records)); }, [records]);

  const filtered = useMemo(() => records.filter((record) => Object.values(record).some((value) => String(value).toLowerCase().includes(query.toLowerCase()))), [query, records]);
  const visibleBudgets = useMemo(() => budgets.filter((item) => !query || `${item.departmentName} ${item.budgetYear} ${item.status} ${item.notes}`.toLowerCase().includes(query.toLowerCase())), [budgets, query]);
  const visibleExpenses = useMemo(() => expenses.filter((item) => !query || `${item.departmentName} ${item.category} ${item.description} ${item.receiptReference}`.toLowerCase().includes(query.toLowerCase())), [expenses, query]);
  const visiblePerformance = useMemo(() => performance.filter((item) => !query || `${item.departmentName} ${item.goalsAchieved} ${item.status} ${item.notes}`.toLowerCase().includes(query.toLowerCase())), [performance, query]);
  const summary = useMemo(() => ({
    approved: budgets.reduce((sum, item) => sum + item.approvedBudget, 0),
    spent: budgets.reduce((sum, item) => sum + item.amountSpent, 0),
    remaining: budgets.reduce((sum, item) => sum + item.remainingBalance, 0),
    completed: performance.reduce((sum, item) => sum + item.completedActivities, 0),
  }), [budgets, performance]);

  function openForm(record?: DepartmentRecord) { setEditing(record ?? null); setForm(record ? { ...record } : { ...emptyRecord }); setError(""); setShowForm(true); }
  function closeForm() { setEditing(null); setForm(emptyRecord); setShowForm(false); }
  function canEdit(record: DepartmentRecord) { return canManageAll || Boolean(userId && record.leaderId === userId); }
  function canWorkOnDepartment(departmentId: string) { return canManageBudgets || records.some((record) => record.id === departmentId && record.leaderId === userId); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(form.name, "Department name");
    if (validationError) { setError(validationError); return; }
    if (!canManageAll) { setError("Only Super Admin, Pastor, Secretary, or Church Clerk can manage departments."); return; }
    const duplicate = records.find((record) => record.id !== editing?.id && record.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (duplicate) { setError("Department already exists."); return; }
    setSaving(true);
    const supabase = createClient();
    let saved = { ...form, id: editing?.id ?? crypto.randomUUID() };
    if (supabase) {
      const payload = { name: form.name.trim(), description: form.description || null, meeting_schedule: form.meetingSchedule || null, leader_id: form.leaderId || null, is_active: form.isActive, created_by: editing ? undefined : userId || null, updated_by: userId || null };
      const request = editing ? supabase.from("departments").update(payload).eq("id", editing.id).select().single() : supabase.from("departments").insert(payload).select().single();
      const { data, error: saveError } = await request;
      if (saveError) { setError(saveError.code === "23505" ? "Department already exists." : saveError.message); setSaving(false); return; }
      saved = { ...saved, id: data.id, name: data.name, leader: leaders.find((leader) => leader.id === form.leaderId)?.name ?? "", memberCount: editing?.memberCount ?? 0 };
    }
    setRecords((current) => editing ? current.map((item) => item.id === editing.id ? saved : item) : [...current, saved]);
    setNotice(editing ? "Department updated." : "Department added.");
    setSaving(false); closeForm();
  }

  async function toggleActive(record: DepartmentRecord) {
    if (!canManageAll) { setError("Only Super Admin, Pastor, Secretary, or Church Clerk can activate or deactivate departments."); return; }
    const supabase = createClient();
    if (supabase) {
      const { error: updateError } = await supabase.from("departments").update({ is_active: !record.isActive, updated_by: userId || null }).eq("id", record.id);
      if (updateError) { setError(updateError.message); return; }
    }
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, isActive: !item.isActive } : item));
    setNotice(`${record.name} ${record.isActive ? "deactivated" : "activated"}.`);
  }

  async function saveBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageBudgets) { setError("Only Super Admin and Treasurer can create or edit department budgets."); return; }
    const validationError = required(budgetForm.departmentId, "Department") || required(String(budgetForm.budgetYear), "Budget year") || required(budgetForm.approvedBudget, "Approved budget amount");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = { department_id: budgetForm.departmentId, budget_year: Number(budgetForm.budgetYear), approved_budget_amount: Number(budgetForm.approvedBudget), budget_status: budgetForm.status, notes: budgetForm.notes || null };
      const request = editingBudget ? supabase.from("department_budgets").update(payload).eq("id", editingBudget.id) : supabase.from("department_budgets").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.code === "23505" ? "Budget already exists for this department and year." : saveError.message); setSaving(false); return; }
    }
    setNotice(editingBudget ? "Department budget updated." : "Department budget added.");
    setShowBudgetForm(false); setEditingBudget(null); setBudgetForm(emptyBudget); setSaving(false); await load();
  }

  async function saveExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(expenseForm.departmentId, "Department") || required(expenseForm.expenseDate, "Expense date") || required(expenseForm.category, "Category") || required(expenseForm.description, "Description") || required(expenseForm.amount, "Amount");
    if (validationError) { setError(validationError); return; }
    if (!canWorkOnDepartment(expenseForm.departmentId)) { setError("Department Heads can submit expenses only for their assigned department."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = { department_id: expenseForm.departmentId, expense_date: expenseForm.expenseDate, category: expenseForm.category, description: expenseForm.description, amount: Number(expenseForm.amount), receipt_reference: expenseForm.receiptReference || null, recorded_by: userId || null };
      const request = editingExpense ? supabase.from("department_expenses").update(payload).eq("id", editingExpense.id) : supabase.from("department_expenses").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setNotice(editingExpense ? "Department expense updated." : "Department expense recorded.");
    setShowExpenseForm(false); setEditingExpense(null); setExpenseForm(emptyExpense); setSaving(false); await load();
  }

  async function savePerformance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(performanceForm.departmentId, "Department") || required(performanceForm.periodStart, "Period start") || required(performanceForm.periodEnd, "Period end");
    if (validationError) { setError(validationError); return; }
    if (!canWorkOnDepartment(performanceForm.departmentId)) { setError("Department Heads can submit performance updates only for their assigned department."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = { department_id: performanceForm.departmentId, period_start: performanceForm.periodStart, period_end: performanceForm.periodEnd, planned_activities: Number(performanceForm.plannedActivities || 0), completed_activities: Number(performanceForm.completedActivities || 0), attendance_count: Number(performanceForm.attendanceCount || 0), visitor_engagement: Number(performanceForm.visitorEngagement || 0), members_involved: Number(performanceForm.membersInvolved || 0), goals_achieved: performanceForm.goalsAchieved || null, performance_status: performanceForm.status, notes: performanceForm.notes || null, submitted_by: userId || null };
      const request = editingPerformance ? supabase.from("department_performance").update(payload).eq("id", editingPerformance.id) : supabase.from("department_performance").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setNotice(editingPerformance ? "Department performance updated." : "Department performance submitted.");
    setShowPerformanceForm(false); setEditingPerformance(null); setPerformanceForm(emptyPerformance); setSaving(false); await load();
  }

  function exportExcel() {
    if (activeTab === "Expenses") downloadWorkbook("Department-Expenses.xls", "Expenses", ["Date", "Department", "Category", "Description", "Amount", "Recorded By", "Receipt"], visibleExpenses.map((item) => [item.expenseDate, item.departmentName, item.category, item.description, item.amount, item.recordedBy, item.receiptReference]));
    else if (activeTab === "Performance") downloadWorkbook("Department-Performance.xls", "Performance", ["Department", "Period", "Planned", "Completed", "Attendance", "Visitors", "Members", "Status", "Goals"], visiblePerformance.map((item) => [item.departmentName, `${item.periodStart} - ${item.periodEnd}`, item.plannedActivities, item.completedActivities, item.attendanceCount, item.visitorEngagement, item.membersInvolved, labelize(item.status), item.goalsAchieved]));
    else downloadWorkbook("Department-Budgets.xls", "Budgets", ["Department", "Year", "Approved", "Spent", "Remaining", "Status", "Notes"], visibleBudgets.map((item) => [item.departmentName, item.budgetYear, item.approvedBudget, item.amountSpent, item.remainingBalance, labelize(item.status), item.notes]));
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text(`Department ${activeTab} Report`, 14, 16);
    document.setFontSize(9);
    document.text(`Approved: ${currency.format(summary.approved)} | Spent: ${currency.format(summary.spent)} | Remaining: ${currency.format(summary.remaining)} | Completed Activities: ${summary.completed}`, 14, 23);
    const table = activeTab === "Expenses"
      ? { head: [["Date", "Department", "Category", "Description", "Amount", "Recorded By", "Receipt"]], body: visibleExpenses.map((item) => [item.expenseDate, item.departmentName, item.category, item.description, currency.format(item.amount), item.recordedBy, item.receiptReference]) }
      : activeTab === "Performance"
        ? { head: [["Department", "Period", "Planned", "Completed", "Attendance", "Visitors", "Members", "Status", "Goals"]], body: visiblePerformance.map((item) => [item.departmentName, `${item.periodStart} - ${item.periodEnd}`, item.plannedActivities, item.completedActivities, item.attendanceCount, item.visitorEngagement, item.membersInvolved, labelize(item.status), item.goalsAchieved]) }
        : { head: [["Department", "Year", "Approved", "Spent", "Remaining", "Status", "Notes"]], body: visibleBudgets.map((item) => [item.departmentName, item.budgetYear, currency.format(item.approvedBudget), currency.format(item.amountSpent), currency.format(item.remainingBalance), labelize(item.status), item.notes]) };
    autoTableModule.default(document, { startY: 30, ...table, styles: { fontSize: 8 }, headStyles: { fillColor: [8, 41, 76] } });
    document.save(`Department-${activeTab}-Report.pdf`);
  }

  return <div className="space-y-6">
    <PageHeading title="Departments" description="Coordinate SDA ministries, budgets, expenses, performance, leaders, and service teams." />
    {notice && <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-churchblue">{notice}</p>}
    {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2">{tabs.map((tab) => <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab)}>{tab}</Button>)}</div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={BadgeEuro} label="Approved Budget" value={currency.format(summary.approved)} />
      <Metric icon={TrendingUp} label="Amount Spent" value={currency.format(summary.spent)} />
      <Metric icon={Target} label="Remaining Balance" value={currency.format(summary.remaining)} />
      <Metric icon={Activity} label="Completed Activities" value={String(summary.completed)} />
    </section>
    <Card>
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center"><label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder={`Search ${activeTab.toLowerCase()}...`} value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="flex flex-wrap gap-2">{activeTab === "Departments" && canManageAll && <Button onClick={() => openForm()}><Plus className="h-4 w-4" /> Add Department</Button>}{activeTab === "Budget" && canManageBudgets && <Button onClick={() => { setEditingBudget(null); setBudgetForm(emptyBudget); setShowBudgetForm(true); }}><Plus className="h-4 w-4" /> Add Budget</Button>}{activeTab === "Expenses" && canSubmitDepartmentUpdates && <Button onClick={() => { setEditingExpense(null); setExpenseForm({ ...emptyExpense, departmentId: departmentOptions[0]?.id ?? "" }); setShowExpenseForm(true); }}><Plus className="h-4 w-4" /> Add Expense</Button>}{activeTab === "Performance" && canSubmitDepartmentUpdates && <Button onClick={() => { setEditingPerformance(null); setPerformanceForm({ ...emptyPerformance, departmentId: departmentOptions[0]?.id ?? "" }); setShowPerformanceForm(true); }}><Plus className="h-4 w-4" /> Add Performance</Button>}{canViewReports && activeTab !== "Departments" && <><Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button><Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button></>}</div></div>
      {activeTab === "Departments" && <DepartmentCards loading={loading} records={filtered} canEdit={canEdit} openForm={openForm} toggleActive={toggleActive} canManageAll={canManageAll} />}
      {activeTab === "Budget" && <BudgetTable rows={visibleBudgets} canEdit={canManageBudgets} onEdit={(row) => { setEditingBudget(row); setBudgetForm({ departmentId: row.departmentId, budgetYear: row.budgetYear, approvedBudget: String(row.approvedBudget), status: row.status, notes: row.notes }); setShowBudgetForm(true); }} />}
      {activeTab === "Expenses" && <ExpenseTable rows={visibleExpenses} canEdit={canSubmitDepartmentUpdates} canWorkOnDepartment={canWorkOnDepartment} onEdit={(row) => { setEditingExpense(row); setExpenseForm({ departmentId: row.departmentId, expenseDate: row.expenseDate, category: row.category, description: row.description, amount: String(row.amount), receiptReference: row.receiptReference }); setShowExpenseForm(true); }} />}
      {activeTab === "Performance" && <PerformanceTable rows={visiblePerformance} canEdit={canSubmitDepartmentUpdates} canWorkOnDepartment={canWorkOnDepartment} onEdit={(row) => { setEditingPerformance(row); setPerformanceForm({ departmentId: row.departmentId, periodStart: row.periodStart, periodEnd: row.periodEnd, plannedActivities: String(row.plannedActivities), completedActivities: String(row.completedActivities), attendanceCount: String(row.attendanceCount), visitorEngagement: String(row.visitorEngagement), membersInvolved: String(row.membersInvolved), goalsAchieved: row.goalsAchieved, status: row.status, notes: row.notes }); setShowPerformanceForm(true); }} />}
      {activeTab === "Reports" && <Reports budgets={visibleBudgets} expenses={visibleExpenses} performance={visiblePerformance} />}
    </Card>
    {showForm && <DepartmentModal editing={editing} error={error} form={form} leaders={leaders} saving={saving} setForm={setForm} onClose={closeForm} onSubmit={save} />}
    {showBudgetForm && <BudgetModal departments={records} form={budgetForm} saving={saving} setForm={setBudgetForm} onClose={() => setShowBudgetForm(false)} onSubmit={saveBudget} />}
    {showExpenseForm && <ExpenseModal departments={departmentOptions} form={expenseForm} saving={saving} setForm={setExpenseForm} onClose={() => setShowExpenseForm(false)} onSubmit={saveExpense} />}
    {showPerformanceForm && <PerformanceModal departments={departmentOptions} form={performanceForm} saving={saving} setForm={setPerformanceForm} onClose={() => setShowPerformanceForm(false)} onSubmit={savePerformance} />}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof BadgeEuro; label: string; value: string }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-lg bg-blue-50 p-3 text-churchblue"><Icon className="h-5 w-5" /></div><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div></Card>;
}

function DepartmentCards({ loading, records, canEdit, openForm, toggleActive, canManageAll }: { loading: boolean; records: DepartmentRecord[]; canEdit: (record: DepartmentRecord) => boolean; openForm: (record: DepartmentRecord) => void; toggleActive: (record: DepartmentRecord) => void; canManageAll: boolean }) {
  if (loading) return <p className="p-8 text-center text-sm text-slate-500">Loading departments...</p>;
  return <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{records.map((record) => <div className="rounded-xl border border-slate-100 p-4" key={record.id}><div className="flex justify-between"><div className="rounded-lg bg-blue-50 p-2.5 text-churchblue"><Users className="h-5 w-5" /></div><StatusBadge tone={record.isActive ? "green" : "slate"}>{record.isActive ? "Active" : "Inactive"}</StatusBadge></div><h2 className="mt-4 font-bold text-navy">{record.name}</h2><p className="mt-2 min-h-10 text-sm text-slate-500">{record.description}</p><div className="mt-3 space-y-1 text-xs text-slate-400"><p>Leader: {record.leader || "Not assigned"}</p><p>Meeting: {record.meetingSchedule || "Not scheduled"}</p><p>Members: {record.memberCount}</p><p>Created: {record.createdAt || "Not recorded"}</p></div>{canEdit(record) && <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3"><Button variant="ghost" size="icon" aria-label={`Edit ${record.name}`} onClick={() => openForm(record)}><Pencil className="h-4 w-4" /></Button>{canManageAll && <Button variant="ghost" size="icon" aria-label={`${record.isActive ? "Deactivate" : "Activate"} ${record.name}`} onClick={() => toggleActive(record)}>{record.isActive ? <ToggleRight className="h-4 w-4 text-emerald-700" /> : <ToggleLeft className="h-4 w-4 text-slate-500" />}</Button>}</div>}</div>)}{records.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No departments found.</p>}</div>;
}

function BudgetTable({ rows, canEdit, onEdit }: { rows: DepartmentBudget[]; canEdit: boolean; onEdit: (row: DepartmentBudget) => void }) {
  return <Table headers={["Department", "Year", "Approved", "Spent", "Remaining", "Status", "Notes", ""]}>{rows.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4 font-semibold text-navy">{row.departmentName}</td><td className="px-5 py-4">{row.budgetYear}</td><td className="px-5 py-4">{currency.format(row.approvedBudget)}</td><td className="px-5 py-4">{currency.format(row.amountSpent)}</td><td className="px-5 py-4">{currency.format(row.remainingBalance)}</td><td className="px-5 py-4"><StatusBadge tone={statusTone(row.status)}>{labelize(row.status)}</StatusBadge></td><td className="px-5 py-4 text-slate-500">{row.notes || "-"}</td><td className="px-5 py-4">{canEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /> Edit</Button>}</td></tr>)}{rows.length === 0 && <Empty colSpan={8} />}</Table>;
}

function ExpenseTable({ rows, canEdit, canWorkOnDepartment, onEdit }: { rows: DepartmentExpense[]; canEdit: boolean; canWorkOnDepartment: (departmentId: string) => boolean; onEdit: (row: DepartmentExpense) => void }) {
  return <Table headers={["Date", "Department", "Category", "Description", "Amount", "Recorded By", "Receipt", ""]}>{rows.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4">{row.expenseDate}</td><td className="px-5 py-4 font-semibold text-navy">{row.departmentName}</td><td className="px-5 py-4">{row.category}</td><td className="px-5 py-4 text-slate-500">{row.description}</td><td className="px-5 py-4 font-semibold">{currency.format(row.amount)}</td><td className="px-5 py-4">{row.recordedBy}</td><td className="px-5 py-4">{row.receiptReference || "-"}</td><td className="px-5 py-4">{canEdit && canWorkOnDepartment(row.departmentId) && <Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /> Edit</Button>}</td></tr>)}{rows.length === 0 && <Empty colSpan={8} />}</Table>;
}

function PerformanceTable({ rows, canEdit, canWorkOnDepartment, onEdit }: { rows: DepartmentPerformance[]; canEdit: boolean; canWorkOnDepartment: (departmentId: string) => boolean; onEdit: (row: DepartmentPerformance) => void }) {
  return <Table headers={["Department", "Period", "Planned", "Completed", "Attendance", "Visitors", "Members", "Status", "Goals", ""]}>{rows.map((row) => <tr className="border-t border-slate-100" key={row.id}><td className="px-5 py-4 font-semibold text-navy">{row.departmentName}</td><td className="px-5 py-4">{row.periodStart} - {row.periodEnd}</td><td className="px-5 py-4">{row.plannedActivities}</td><td className="px-5 py-4">{row.completedActivities}</td><td className="px-5 py-4">{row.attendanceCount}</td><td className="px-5 py-4">{row.visitorEngagement}</td><td className="px-5 py-4">{row.membersInvolved}</td><td className="px-5 py-4"><StatusBadge tone={statusTone(row.status)}>{labelize(row.status)}</StatusBadge></td><td className="px-5 py-4 text-slate-500">{row.goalsAchieved || "-"}</td><td className="px-5 py-4">{canEdit && canWorkOnDepartment(row.departmentId) && <Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /> Edit</Button>}</td></tr>)}{rows.length === 0 && <Empty colSpan={10} />}</Table>;
}

function Reports({ budgets, expenses, performance }: { budgets: DepartmentBudget[]; expenses: DepartmentExpense[]; performance: DepartmentPerformance[] }) {
  const rows = budgets.map((budget) => {
    const perf = performance.find((item) => item.departmentId === budget.departmentId);
    return { department: budget.departmentName, approved: budget.approvedBudget, spent: budget.amountSpent, expenseCount: expenses.filter((expense) => expense.departmentId === budget.departmentId).length, completed: perf?.completedActivities ?? 0, attendance: perf?.attendanceCount ?? 0, status: perf?.status ?? budget.status };
  });
  return <Table headers={["Department", "Approved", "Spent", "Expense Records", "Completed Activities", "Attendance", "Status"]}>{rows.map((row) => <tr className="border-t border-slate-100" key={row.department}><td className="px-5 py-4 font-semibold text-navy">{row.department}</td><td className="px-5 py-4">{currency.format(row.approved)}</td><td className="px-5 py-4">{currency.format(row.spent)}</td><td className="px-5 py-4">{row.expenseCount}</td><td className="px-5 py-4">{row.completed}</td><td className="px-5 py-4">{row.attendance}</td><td className="px-5 py-4"><StatusBadge tone={statusTone(row.status)}>{labelize(row.status)}</StatusBadge></td></tr>)}{rows.length === 0 && <Empty colSpan={7} />}</Table>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{headers.map((header) => <th className="px-5 py-3 font-semibold" key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Empty({ colSpan }: { colSpan: number }) {
  return <tr><td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={colSpan}>No records found.</td></tr>;
}

function DepartmentModal({ editing, error, form, leaders, saving, setForm, onClose, onSubmit }: { editing: DepartmentRecord | null; error: string; form: DepartmentRecord; leaders: LeaderOption[]; saving: boolean; setForm: (form: DepartmentRecord) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title={editing ? "Edit Department" : "Add Department"} saving={saving} onClose={onClose} onSubmit={onSubmit}>{error && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Department Name<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter department name" /></label><label className="text-sm font-semibold text-slate-700">Meeting Schedule<input className={fieldClass} value={form.meetingSchedule} onChange={(event) => setForm({ ...form, meetingSchedule: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Department Head<select className={fieldClass} value={form.leaderId ?? ""} onChange={(event) => setForm({ ...form, leaderId: event.target.value })}><option value="">No department head assigned</option>{leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}{leader.email ? ` (${leader.email})` : ""}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active department</label></div></Modal>;
}

function BudgetModal({ departments, form, saving, setForm, onClose, onSubmit }: { departments: DepartmentRecord[]; form: typeof emptyBudget; saving: boolean; setForm: (form: typeof emptyBudget) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Department Budget" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><DepartmentSelect departments={departments} value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} /><label className="text-sm font-semibold text-slate-700">Budget Year<input className={fieldClass} min="2020" type="number" value={form.budgetYear} onChange={(event) => setForm({ ...form, budgetYear: Number(event.target.value) })} /></label><label className="text-sm font-semibold text-slate-700">Approved Budget Amount<input className={fieldClass} min="0" step="0.01" type="number" value={form.approvedBudget} onChange={(event) => setForm({ ...form, approvedBudget: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Budget Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BudgetStatus })}>{budgetStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div></Modal>;
}

function ExpenseModal({ departments, form, saving, setForm, onClose, onSubmit }: { departments: DepartmentRecord[]; form: typeof emptyExpense; saving: boolean; setForm: (form: typeof emptyExpense) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Department Expense" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><DepartmentSelect departments={departments} value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} /><label className="text-sm font-semibold text-slate-700">Expense Date<input className={fieldClass} type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Category<select className={fieldClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Amount<input className={fieldClass} min="0" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Receipt / Reference<input className={fieldClass} value={form.receiptReference} onChange={(event) => setForm({ ...form, receiptReference: event.target.value })} /></label></div></Modal>;
}

function PerformanceModal({ departments, form, saving, setForm, onClose, onSubmit }: { departments: DepartmentRecord[]; form: typeof emptyPerformance; saving: boolean; setForm: (form: typeof emptyPerformance) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Department Performance" saving={saving} onClose={onClose} onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><DepartmentSelect departments={departments} value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} /><label className="text-sm font-semibold text-slate-700">Performance Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PerformanceStatus })}>{performanceStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Period Start<input className={fieldClass} type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Period End<input className={fieldClass} type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /></label><NumberInput label="Planned Activities" value={form.plannedActivities} onChange={(value) => setForm({ ...form, plannedActivities: value })} /><NumberInput label="Completed Activities" value={form.completedActivities} onChange={(value) => setForm({ ...form, completedActivities: value })} /><NumberInput label="Attendance Count" value={form.attendanceCount} onChange={(value) => setForm({ ...form, attendanceCount: value })} /><NumberInput label="Visitor Engagement" value={form.visitorEngagement} onChange={(value) => setForm({ ...form, visitorEngagement: value })} /><NumberInput label="Members Involved" value={form.membersInvolved} onChange={(value) => setForm({ ...form, membersInvolved: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Goals Achieved<textarea className={textareaClass} value={form.goalsAchieved} onChange={(event) => setForm({ ...form, goalsAchieved: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div></Modal>;
}

function DepartmentSelect({ departments, value, onChange }: { departments: DepartmentRecord[]; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">Department<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>;
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<input className={fieldClass} min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Modal({ title, children, saving, onClose, onSubmit }: { title: string; children: React.ReactNode; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-navy">{title}</h2><Button type="button" variant="ghost" size="icon" aria-label={`Close ${title} form`} onClick={onClose}><X className="h-5 w-5" /></Button></div><div className="space-y-4 p-5">{children}</div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save"}</Button></div></form></div>;
}
