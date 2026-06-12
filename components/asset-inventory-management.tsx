"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive, Boxes, ClipboardCheck, Download, FileSpreadsheet, Hammer, LogIn, LogOut, Pencil, Plus, Search, Wrench, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { APP_ROLES, ROLE_LABELS, normalizeRoles, type AppRole } from "@/lib/auth";
import { required } from "@/lib/validation";

type AssetStatus = "available" | "assigned" | "in_use" | "under_maintenance" | "retired" | "lost";
type AssignmentType = "member" | "department" | "pastor" | "church_role" | "location";
type Tab = "assets" | "assignments" | "maintenance" | "inventory" | "qr" | "reports";
type Category = { id: string; name: string; isActive: boolean };
type Option = { id: string; name: string };
type Asset = {
  id: string;
  assetNumber: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  serialNumber: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  location: string;
  status: AssetStatus;
  assignedMemberId: string;
  assignedDepartmentId: string;
  assignedProfileId: string;
  notes: string;
};
type Assignment = { id: string; assetId: string; assignedToType: AssignmentType; memberId: string; departmentId: string; profileId: string; assignedRole: string; assignedLocation: string; checkedOutAt: string; checkedInAt: string; expectedReturnDate: string; conditionOut: string; conditionIn: string; notes: string };
type Maintenance = { id: string; assetId: string; maintenanceDate: string; maintenanceType: string; serviceProvider: string; maintenanceCost: number; nextMaintenanceDate: string; status: string; notes: string };
type InventoryItem = { id: string; itemNumber: string; name: string; category: string; description: string; quantity: number; reorderLevel: number; unitCost: number; supplier: string; location: string; notes: string };
type Purchase = { id: string; inventoryItemId: string; purchaseDate: string; quantity: number; unitCost: number; supplier: string; receiptReference: string; notes: string };
type Adjustment = { id: string; inventoryItemId: string; adjustmentDate: string; quantityChange: number; reason: string; notes: string };

const emptyAsset: Asset = { id: "", assetNumber: "", name: "", categoryId: "", categoryName: "", description: "", serialNumber: "", purchaseDate: "", purchaseCost: 0, currentValue: 0, location: "", status: "available", assignedMemberId: "", assignedDepartmentId: "", assignedProfileId: "", notes: "" };
const emptyInventory: InventoryItem = { id: "", itemNumber: "", name: "", category: "", description: "", quantity: 0, reorderLevel: 0, unitCost: 0, supplier: "", location: "", notes: "" };
const emptyMaintenance = { assetId: "", maintenanceDate: new Date().toISOString().slice(0, 10), maintenanceType: "scheduled", serviceProvider: "", maintenanceCost: 0, nextMaintenanceDate: "", status: "scheduled", notes: "" };
const emptyAssignment = { assetId: "", assignedToType: "member" as AssignmentType, memberId: "", departmentId: "", profileId: "", assignedRole: "", assignedLocation: "", checkedOutAt: new Date().toISOString().slice(0, 16), expectedReturnDate: "", conditionOut: "", notes: "" };
const emptyPurchase = { inventoryItemId: "", purchaseDate: new Date().toISOString().slice(0, 10), quantity: 1, unitCost: 0, supplier: "", receiptReference: "", notes: "" };
const emptyAdjustment = { inventoryItemId: "", quantityChange: 0, reason: "", notes: "" };
const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const textareaClass = "mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none focus:border-churchblue";
const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const inventoryCategories = [
  "Audio Equipment",
  "Church Supplies",
  "Office Supplies",
  "Cleaning Supplies",
  "Communion Supplies",
  "Media Equipment",
  "Maintenance Supplies",
  "Other",
];

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

function qrPattern(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return Array.from({ length: 121 }, (_, index) => ((hash >> (index % 24)) + index + Math.floor(index / 11)) % 3 === 0);
}

function AssetQr({ asset }: { asset: Asset }) {
  return <div className="inline-grid grid-cols-[repeat(11,0.55rem)] gap-0.5 rounded-lg border border-slate-200 bg-white p-3" aria-label={`QR code for ${asset.assetNumber}`}>{qrPattern(asset.assetNumber || asset.id).map((filled, index) => <span className={`h-2 w-2 ${filled ? "bg-navy" : "bg-white"}`} key={index} />)}</div>;
}

function nextNumber(prefix: string, values: string[]) {
  const year = new Date().getFullYear();
  const max = values.reduce((current, value) => {
    const match = value.match(new RegExp(`${prefix}-${year}-(\\d+)`));
    return Math.max(current, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

function newAssignmentForm(assetId = "") {
  return { ...emptyAssignment, assetId, checkedOutAt: new Date().toISOString().slice(0, 16) };
}

function downloadWorkbook(name: string, worksheet: string, headers: string[], rows: string[][]) {
  const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
  const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${worksheet}"><Table>${row(headers)}${rows.map(row).join("")}</Table></Worksheet></Workbook>`;
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function AssetInventoryManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [members, setMembers] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const [query, setQuery] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetForm, setAssetForm] = useState<Asset>(emptyAsset);
  const [inventoryForm, setInventoryForm] = useState<InventoryItem>(emptyInventory);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenance);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase);
  const [adjustmentForm, setAdjustmentForm] = useState(emptyAdjustment);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);

  const canManageRecords = roles.some((role) => role === "super_admin" || role === "secretary");
  const canManageValues = roles.some((role) => role === "super_admin" || role === "secretary" || role === "treasurer");
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => !needle || [asset.assetNumber, asset.name, asset.categoryName, asset.location, asset.status, asset.serialNumber].some((value) => value.toLowerCase().includes(needle)));
  }, [assets, query]);
  const stats = [
    { label: "Total Assets", value: assets.length, icon: Archive, tone: "bg-blue-50 text-churchblue" },
    { label: "Assets Assigned", value: assets.filter((asset) => asset.status === "assigned" || asset.status === "in_use").length, icon: ClipboardCheck, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Under Maintenance", value: assets.filter((asset) => asset.status === "under_maintenance").length, icon: Wrench, tone: "bg-amber-50 text-amber-700" },
    { label: "Assets Available", value: assets.filter((asset) => asset.status === "available").length, icon: LogIn, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Total Asset Value", value: currency.format(assets.reduce((sum, asset) => sum + asset.currentValue, 0)), icon: FileSpreadsheet, tone: "bg-purple-50 text-purple-700" },
    { label: "Low Stock Items", value: inventory.filter((item) => item.quantity <= item.reorderLevel).length, icon: Boxes, tone: "bg-rose-50 text-rose-700" },
  ];

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles(normalizeRoles((roleRows ?? []).map(({ role }) => role)));
    }
    const [categoryResult, assetResult, assignmentResult, maintenanceResult, inventoryResult, purchaseResult, adjustmentResult, memberResult, departmentResult] = await Promise.all([
      supabase.from("asset_categories").select("id, name, is_active").order("name"),
      supabase.from("assets").select("*").order("created_at", { ascending: false }),
      supabase.from("asset_assignments").select("*").order("checked_out_at", { ascending: false }),
      supabase.from("asset_maintenance").select("*").order("maintenance_date", { ascending: false }),
      supabase.from("inventory_items").select("*").order("name"),
      supabase.from("inventory_purchases").select("*").order("purchase_date", { ascending: false }),
      supabase.from("inventory_adjustments").select("*").order("created_at", { ascending: false }),
      supabase.from("members").select("id, member_id, full_name, first_name, last_name").eq("status", "active").order("full_name"),
      supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (assetResult.error || categoryResult.error) setError(`${assetResult.error?.message ?? categoryResult.error?.message}. Apply migration 202606120002_asset_inventory_management.sql in Supabase.`);
    const categoryRows = (categoryResult.data ?? []).map((category) => ({ id: category.id, name: category.name, isActive: Boolean(category.is_active) }));
    setCategories(categoryRows);
    const categoryName = new Map(categoryRows.map((category) => [category.id, category.name]));
    setAssets((assetResult.data ?? []).map((row) => ({
      id: row.id,
      assetNumber: row.asset_number,
      name: row.name,
      categoryId: row.category_id ?? "",
      categoryName: categoryName.get(row.category_id ?? "") ?? "",
      description: row.description ?? "",
      serialNumber: row.serial_number ?? "",
      purchaseDate: row.purchase_date ?? "",
      purchaseCost: Number(row.purchase_cost ?? 0),
      currentValue: Number(row.current_value ?? 0),
      location: row.location ?? "",
      status: row.status,
      assignedMemberId: row.assigned_member_id ?? "",
      assignedDepartmentId: row.assigned_department_id ?? "",
      assignedProfileId: row.assigned_profile_id ?? "",
      notes: row.notes ?? "",
    })));
    setAssignments((assignmentResult.data ?? []).map((row) => ({ id: row.id, assetId: row.asset_id, assignedToType: row.assigned_to_type, memberId: row.member_id ?? "", departmentId: row.department_id ?? "", profileId: row.profile_id ?? "", assignedRole: row.assigned_role ?? "", assignedLocation: row.assigned_location ?? "", checkedOutAt: row.checked_out_at ?? "", checkedInAt: row.checked_in_at ?? "", expectedReturnDate: row.expected_return_date ?? "", conditionOut: row.condition_out ?? "", conditionIn: row.condition_in ?? "", notes: row.notes ?? "" })));
    setMaintenance((maintenanceResult.data ?? []).map((row) => ({ id: row.id, assetId: row.asset_id, maintenanceDate: row.maintenance_date ?? "", maintenanceType: row.maintenance_type ?? "", serviceProvider: row.service_provider ?? "", maintenanceCost: Number(row.maintenance_cost ?? 0), nextMaintenanceDate: row.next_maintenance_date ?? "", status: row.status ?? "scheduled", notes: row.notes ?? "" })));
    setInventory((inventoryResult.data ?? []).map((row) => ({ id: row.id, itemNumber: row.item_number, name: row.name, category: row.category ?? "", description: row.description ?? "", quantity: Number(row.quantity ?? 0), reorderLevel: Number(row.reorder_level ?? 0), unitCost: Number(row.unit_cost ?? 0), supplier: row.supplier ?? "", location: row.location ?? "", notes: row.notes ?? "" })));
    setPurchases((purchaseResult.data ?? []).map((row) => ({ id: row.id, inventoryItemId: row.inventory_item_id, purchaseDate: row.purchase_date ?? "", quantity: Number(row.quantity ?? 0), unitCost: Number(row.unit_cost ?? 0), supplier: row.supplier ?? "", receiptReference: row.receipt_reference ?? "", notes: row.notes ?? "" })));
    setAdjustments((adjustmentResult.data ?? []).map((row) => ({ id: row.id, inventoryItemId: row.inventory_item_id, adjustmentDate: row.adjustment_date ?? "", quantityChange: Number(row.quantity_change ?? 0), reason: row.reason ?? "", notes: row.notes ?? "" })));
    setMembers((memberResult.data ?? []).map((member) => ({ id: member.id, name: member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.member_id || "Member" })));
    setDepartments((departmentResult.data ?? []).map((department) => ({ id: department.id, name: department.name })));
    setLoading(false);
  }

  function openAssetForm(asset?: Asset) {
    setAssetForm(asset ?? { ...emptyAsset, assetNumber: nextNumber("AST", assets.map((item) => item.assetNumber)) });
    setShowAssetForm(true);
  }

  function openInventoryForm(item?: InventoryItem) {
    setInventoryForm(item ?? { ...emptyInventory, itemNumber: nextNumber("INV", inventory.map((record) => record.itemNumber)) });
    setShowInventoryForm(true);
  }

  function openAssignmentForm(assetId = "") {
    setAssignmentForm(newAssignmentForm(assetId));
    setShowAssignmentForm(true);
  }

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(assetForm.assetNumber, "Asset ID") || required(assetForm.name, "Asset name");
    if (validationError) { setError(validationError); return; }
    if (!canManageValues) { setError("Only Admin, Secretary, or Treasurer can manage asset records."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = { asset_number: assetForm.assetNumber, name: assetForm.name, category_id: assetForm.categoryId || null, description: assetForm.description || null, serial_number: assetForm.serialNumber || null, purchase_date: assetForm.purchaseDate || null, purchase_cost: assetForm.purchaseCost, current_value: assetForm.currentValue, location: assetForm.location || null, status: assetForm.status, notes: assetForm.notes || null, updated_by: user?.id ?? null, created_by: assetForm.id ? undefined : user?.id ?? null };
      const request = assetForm.id ? supabase.from("assets").update(payload).eq("id", assetForm.id) : supabase.from("assets").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setNotice("Asset record saved.");
    setShowAssetForm(false);
    setSaving(false);
    await loadData();
  }

  async function saveInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = required(inventoryForm.itemNumber, "Item ID") || required(inventoryForm.name, "Item name");
    if (validationError) { setError(validationError); return; }
    if (!canManageValues) { setError("Only Admin, Secretary, or Treasurer can manage inventory."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = { item_number: inventoryForm.itemNumber, name: inventoryForm.name, category: inventoryForm.category || null, description: inventoryForm.description || null, quantity: inventoryForm.quantity, reorder_level: inventoryForm.reorderLevel, unit_cost: inventoryForm.unitCost, supplier: inventoryForm.supplier || null, location: inventoryForm.location || null, notes: inventoryForm.notes || null };
      const request = inventoryForm.id ? supabase.from("inventory_items").update(payload).eq("id", inventoryForm.id) : supabase.from("inventory_items").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
    }
    setNotice("Inventory item saved.");
    setShowInventoryForm(false);
    setSaving(false);
    await loadData();
  }

  async function checkOutAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageRecords) { setError("Only Admin or Secretary can manage assignments."); return; }
    if (!assignmentForm.assetId) { setError("Select an asset to assign."); return; }
    if (assignmentForm.assignedToType === "member" && !assignmentForm.memberId) { setError("Select the assigned member."); return; }
    if (assignmentForm.assignedToType === "department" && !assignmentForm.departmentId) { setError("Select the assigned department."); return; }
    if (assignmentForm.assignedToType === "church_role" && !assignmentForm.assignedRole) { setError("Select the assigned church role."); return; }
    if (assignmentForm.assignedToType === "location" && !assignmentForm.assignedLocation.trim()) { setError("Enter the assigned location."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const checkedOutAt = assignmentForm.checkedOutAt ? new Date(assignmentForm.checkedOutAt).toISOString() : new Date().toISOString();
      const { error: assignError } = await supabase.from("asset_assignments").insert({ asset_id: assignmentForm.assetId, assigned_to_type: assignmentForm.assignedToType, member_id: assignmentForm.assignedToType === "member" ? assignmentForm.memberId || null : null, department_id: assignmentForm.assignedToType === "department" ? assignmentForm.departmentId || null : null, profile_id: null, assigned_role: assignmentForm.assignedToType === "church_role" ? assignmentForm.assignedRole || null : null, assigned_location: assignmentForm.assignedToType === "location" ? assignmentForm.assignedLocation.trim() : null, checked_out_at: checkedOutAt, expected_return_date: assignmentForm.expectedReturnDate || null, condition_out: assignmentForm.conditionOut || null, notes: assignmentForm.notes || null, recorded_by: user?.id ?? null });
      if (assignError) { setError(assignError.message); setSaving(false); return; }
      const { error: assetError } = await supabase.from("assets").update({ status: "assigned", assigned_member_id: assignmentForm.assignedToType === "member" ? assignmentForm.memberId || null : null, assigned_department_id: assignmentForm.assignedToType === "department" ? assignmentForm.departmentId || null : null, assigned_profile_id: null }).eq("id", assignmentForm.assetId);
      if (assetError) { setError(assetError.message); setSaving(false); return; }
    }
    setNotice("Asset assigned.");
    setAssignmentForm(emptyAssignment);
    setShowAssignmentForm(false);
    setSaving(false);
    await loadData();
  }

  async function checkInAssignment(assignment: Assignment) {
    if (!canManageRecords) { setError("Only Admin or Secretary can manage assignments."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { error: assignmentError } = await supabase.from("asset_assignments").update({ checked_in_at: new Date().toISOString(), condition_in: assignment.conditionIn || null }).eq("id", assignment.id);
      if (assignmentError) { setError(assignmentError.message); setSaving(false); return; }
      const { error: assetError } = await supabase.from("assets").update({ status: "available", assigned_member_id: null, assigned_department_id: null, assigned_profile_id: null }).eq("id", assignment.assetId);
      if (assetError) { setError(assetError.message); setSaving(false); return; }
    }
    setNotice("Asset checked in.");
    setSaving(false);
    await loadData();
  }

  async function saveMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageValues) { setError("Only Admin, Secretary, or Treasurer can manage maintenance costs."); return; }
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: saveError } = await supabase.from("asset_maintenance").insert({ asset_id: maintenanceForm.assetId, maintenance_date: maintenanceForm.maintenanceDate, maintenance_type: maintenanceForm.maintenanceType, service_provider: maintenanceForm.serviceProvider || null, maintenance_cost: maintenanceForm.maintenanceCost, next_maintenance_date: maintenanceForm.nextMaintenanceDate || null, status: maintenanceForm.status, notes: maintenanceForm.notes || null, recorded_by: user?.id ?? null });
      if (saveError) { setError(saveError.message); return; }
      await supabase.from("assets").update({ status: maintenanceForm.status === "completed" ? "available" : "under_maintenance" }).eq("id", maintenanceForm.assetId);
    }
    setNotice("Maintenance record saved.");
    setMaintenanceForm(emptyMaintenance);
    setShowMaintenanceForm(false);
    await loadData();
  }

  async function savePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageValues) { setError("Only Admin, Secretary, or Treasurer can manage purchases."); return; }
    const item = inventory.find((record) => record.id === purchaseForm.inventoryItemId);
    const supabase = createClient();
    if (supabase && item) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: purchaseError } = await supabase.from("inventory_purchases").insert({ inventory_item_id: purchaseForm.inventoryItemId, purchase_date: purchaseForm.purchaseDate, quantity: purchaseForm.quantity, unit_cost: purchaseForm.unitCost, supplier: purchaseForm.supplier || null, receipt_reference: purchaseForm.receiptReference || null, notes: purchaseForm.notes || null, recorded_by: user?.id ?? null });
      if (purchaseError) { setError(purchaseError.message); return; }
      const { error: itemError } = await supabase.from("inventory_items").update({ quantity: item.quantity + purchaseForm.quantity, unit_cost: purchaseForm.unitCost, supplier: purchaseForm.supplier || item.supplier || null }).eq("id", item.id);
      if (itemError) { setError(itemError.message); return; }
    }
    setNotice("Purchase recorded.");
    setPurchaseForm(emptyPurchase);
    setShowPurchaseForm(false);
    await loadData();
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageValues) { setError("Only Admin, Secretary, or Treasurer can manage stock adjustments."); return; }
    const item = inventory.find((record) => record.id === adjustmentForm.inventoryItemId);
    if (!item) { setError("Select an inventory item."); return; }
    const nextQuantity = Math.max(item.quantity + adjustmentForm.quantityChange, 0);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: adjustmentError } = await supabase.from("inventory_adjustments").insert({ inventory_item_id: adjustmentForm.inventoryItemId, quantity_change: adjustmentForm.quantityChange, reason: adjustmentForm.reason, notes: adjustmentForm.notes || null, recorded_by: user?.id ?? null });
      if (adjustmentError) { setError(adjustmentError.message); return; }
      const { error: itemError } = await supabase.from("inventory_items").update({ quantity: nextQuantity }).eq("id", item.id);
      if (itemError) { setError(itemError.message); return; }
    }
    setNotice("Stock adjustment saved.");
    setAdjustmentForm(emptyAdjustment);
    setShowAdjustmentForm(false);
    await loadData();
  }

  function assetName(id: string) {
    return assets.find((asset) => asset.id === id)?.name ?? "Asset";
  }

  function inventoryName(id: string) {
    return inventory.find((item) => item.id === id)?.name ?? "Inventory item";
  }

  function assigneeName(assignment: Assignment) {
    if (assignment.assignedToType === "member") return members.find((member) => member.id === assignment.memberId)?.name ?? "Member";
    if (assignment.assignedToType === "department") return departments.find((department) => department.id === assignment.departmentId)?.name ?? "Department";
    if (assignment.assignedToType === "pastor") return "Pastor";
    if (assignment.assignedToType === "church_role") return ROLE_LABELS[assignment.assignedRole as AppRole] ?? titleCase(assignment.assignedRole);
    return assignment.assignedLocation || "Location";
  }

  function exportExcel() {
    downloadWorkbook("Hamburg-Ghana-SDA-Assets.xls", "Assets", ["Asset ID", "Name", "Category", "Serial", "Purchase Date", "Cost", "Value", "Location", "Status"], filteredAssets.map((asset) => [asset.assetNumber, asset.name, asset.categoryName, asset.serialNumber, asset.purchaseDate, String(asset.purchaseCost), String(asset.currentValue), asset.location, titleCase(asset.status)]));
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church - Asset Register Report", 14, 16);
    document.setFontSize(9);
    document.text(`Assets: ${assets.length} | Value: ${currency.format(assets.reduce((sum, asset) => sum + asset.currentValue, 0))} | Low stock: ${inventory.filter((item) => item.quantity <= item.reorderLevel).length}`, 14, 23);
    autoTableModule.default(document, { startY: 29, head: [["Asset ID", "Name", "Category", "Serial", "Value", "Location", "Status"]], body: filteredAssets.map((asset) => [asset.assetNumber, asset.name, asset.categoryName, asset.serialNumber, currency.format(asset.currentValue), asset.location, titleCase(asset.status)]), styles: { fontSize: 8 }, headStyles: { fillColor: [8, 41, 76] } });
    document.save("Hamburg-Ghana-SDA-Assets.pdf");
  }

  const scannedAsset = assets.find((asset) => asset.assetNumber.toLowerCase() === scanCode.trim().toLowerCase() || asset.id === scanCode.trim());
  const reportRows = [
    ["Asset Register Report", assets.length],
    ["Asset Assignment Report", assignments.length],
    ["Maintenance Report", maintenance.length],
    ["Inventory Stock Report", inventory.length],
    ["Asset Value Report", currency.format(assets.reduce((sum, asset) => sum + asset.currentValue, 0))],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <PageHeading title="Asset & Inventory Management" description="Track church assets, assignments, maintenance, QR lookup, inventory stock, purchases, and asset value reports." />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> Export PDF</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
          {canManageValues && <Button onClick={() => openAssetForm()}><Plus className="h-4 w-4" /> Add Asset</Button>}
        </div>
      </div>
      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {!canManageValues && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Pastor access is view only. Member accounts cannot access asset records.</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(({ label, value, icon: Icon, tone }) => <Card className="p-4" key={label}><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy">{value}</p></Card>)}
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-card">
        {(["assets", "assignments", "maintenance", "inventory", "qr", "reports"] as Tab[]).map((tab) => <Button key={tab} variant={activeTab === tab ? "default" : "ghost"} onClick={() => setActiveTab(tab)}>{tab === "qr" ? "QR Code System" : titleCase(tab)}</Button>)}
      </div>

      {activeTab === "assets" && <AssetsTab assets={filteredAssets} loading={loading} canManage={canManageValues} query={query} setQuery={setQuery} onEdit={openAssetForm} />}
      {activeTab === "assignments" && <AssignmentsTab assets={assets} assignments={assignments} canManage={canManageRecords} assetName={assetName} assigneeName={assigneeName} onAdd={() => openAssignmentForm()} onCheckIn={checkInAssignment} />}
      {activeTab === "maintenance" && <MaintenanceTab maintenance={maintenance} canManage={canManageValues} assetName={assetName} onAdd={() => setShowMaintenanceForm(true)} />}
      {activeTab === "inventory" && <InventoryTab inventory={inventory} purchases={purchases} adjustments={adjustments} canManage={canManageValues} inventoryName={inventoryName} onAdd={() => openInventoryForm()} onEdit={openInventoryForm} onPurchase={() => setShowPurchaseForm(true)} onAdjust={() => setShowAdjustmentForm(true)} />}
      {activeTab === "qr" && <QrTab assets={assets} scanCode={scanCode} setScanCode={setScanCode} scannedAsset={scannedAsset} onCheckOut={openAssignmentForm} />}
      {activeTab === "reports" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{reportRows.map(([label, value]) => <Card className="p-5" key={label}><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-navy">{value}</p></Card>)}</section>}

      {showAssetForm && <AssetModal form={assetForm} setForm={setAssetForm} categories={categories} saving={saving} onClose={() => setShowAssetForm(false)} onSubmit={saveAsset} />}
      {showInventoryForm && <InventoryModal form={inventoryForm} setForm={setInventoryForm} saving={saving} onClose={() => setShowInventoryForm(false)} onSubmit={saveInventory} />}
      {showAssignmentForm && <AssignmentModal form={assignmentForm} setForm={setAssignmentForm} assets={assets.filter((asset) => asset.status === "available" || asset.id === assignmentForm.assetId)} members={members} departments={departments} saving={saving} onClose={() => setShowAssignmentForm(false)} onSubmit={checkOutAsset} />}
      {showMaintenanceForm && <MaintenanceModal form={maintenanceForm} setForm={setMaintenanceForm} assets={assets} saving={saving} onClose={() => setShowMaintenanceForm(false)} onSubmit={saveMaintenance} />}
      {showPurchaseForm && <PurchaseModal form={purchaseForm} setForm={setPurchaseForm} inventory={inventory} saving={saving} onClose={() => setShowPurchaseForm(false)} onSubmit={savePurchase} />}
      {showAdjustmentForm && <AdjustmentModal form={adjustmentForm} setForm={setAdjustmentForm} inventory={inventory} saving={saving} onClose={() => setShowAdjustmentForm(false)} onSubmit={saveAdjustment} />}
    </div>
  );
}

function AssetsTab({ assets, loading, canManage, query, setQuery, onEdit }: { assets: Asset[]; loading: boolean; canManage: boolean; query: string; setQuery: (value: string) => void; onEdit: (asset: Asset) => void }) {
  return <Card><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row"><label className="flex h-10 max-w-lg flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search assets by ID, name, category, serial, location, or status..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Asset", "Category", "Serial / Location", "Value", "Status", "QR Code", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead><tbody>{loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={7}>Loading assets...</td></tr>}{assets.map((asset) => <tr className="border-t border-slate-100" key={asset.id}><td className="px-5 py-4"><p className="font-bold text-navy">{asset.name}</p><p className="mt-1 text-xs text-slate-400">{asset.assetNumber}</p></td><td className="px-5 py-4 text-slate-600">{asset.categoryName || "Uncategorized"}</td><td className="px-5 py-4 text-slate-600"><p>{asset.serialNumber || "-"}</p><p className="mt-1 text-xs text-slate-400">{asset.location || "No location"}</p></td><td className="px-5 py-4 text-slate-600"><p>{currency.format(asset.currentValue)}</p><p className="mt-1 text-xs text-slate-400">Cost {currency.format(asset.purchaseCost)}</p></td><td className="px-5 py-4"><StatusBadge tone={statusTone(asset.status)}>{titleCase(asset.status)}</StatusBadge></td><td className="px-5 py-4"><AssetQr asset={asset} /></td><td className="px-5 py-4">{canManage && <Button size="sm" variant="ghost" onClick={() => onEdit(asset)}><Pencil className="h-4 w-4" /> Edit</Button>}</td></tr>)}{!loading && assets.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={7}>No assets found.</td></tr>}</tbody></table></div></Card>;
}

function AssignmentsTab({ assignments, canManage, assetName, assigneeName, onAdd, onCheckIn }: { assets: Asset[]; assignments: Assignment[]; canManage: boolean; assetName: (id: string) => string; assigneeName: (assignment: Assignment) => string; onAdd: () => void; onCheckIn: (assignment: Assignment) => void }) {
  return <Card><div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><h2 className="font-bold text-navy">Assignment History</h2>{canManage && <Button size="sm" onClick={onAdd}><LogOut className="h-4 w-4" /> Assign Asset</Button>}</div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Asset", "Assigned To", "Assignment Type", "Checked Out", "Expected Return", "Checked In", "Condition", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead><tbody>{assignments.map((assignment) => <tr className="border-t border-slate-100" key={assignment.id}><td className="px-5 py-4 font-semibold text-navy">{assetName(assignment.assetId)}</td><td className="px-5 py-4 text-slate-600">{assigneeName(assignment)}</td><td className="px-5 py-4 text-slate-600">{titleCase(assignment.assignedToType)}</td><td className="px-5 py-4 text-slate-600">{assignment.checkedOutAt.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-4 text-slate-600">{assignment.expectedReturnDate || "-"}</td><td className="px-5 py-4 text-slate-600">{assignment.checkedInAt ? assignment.checkedInAt.slice(0, 16).replace("T", " ") : "-"}</td><td className="px-5 py-4 text-slate-600">{assignment.conditionOut || "-"}</td><td className="px-5 py-4">{canManage && !assignment.checkedInAt && <Button size="sm" variant="outline" onClick={() => onCheckIn(assignment)}><LogIn className="h-4 w-4" /> Check In</Button>}</td></tr>)}{assignments.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={8}>No assignment history yet.</td></tr>}</tbody></table></div></Card>;
}

function MaintenanceTab({ maintenance, canManage, assetName, onAdd }: { maintenance: Maintenance[]; canManage: boolean; assetName: (id: string) => string; onAdd: () => void }) {
  return <Card><div className="flex justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Maintenance Schedule & History</h2>{canManage && <Button size="sm" onClick={onAdd}><Wrench className="h-4 w-4" /> Add Maintenance</Button>}</div><div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{maintenance.map((item) => <article className="rounded-xl border border-slate-100 p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-navy">{assetName(item.assetId)}</h3><p className="mt-1 text-xs text-slate-400">{item.maintenanceDate} · {titleCase(item.maintenanceType)}</p></div><StatusBadge tone={statusTone(item.status)}>{titleCase(item.status)}</StatusBadge></div><p className="mt-3 text-sm text-slate-600">Provider: {item.serviceProvider || "-"}</p><p className="mt-1 text-sm text-slate-600">Cost: {currency.format(item.maintenanceCost)}</p><p className="mt-1 text-xs text-slate-400">Next maintenance: {item.nextMaintenanceDate || "Not scheduled"}</p></article>)}{maintenance.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No maintenance records found.</div>}</div></Card>;
}

function InventoryTab({ inventory, purchases, adjustments, canManage, inventoryName, onAdd, onEdit, onPurchase, onAdjust }: { inventory: InventoryItem[]; purchases: Purchase[]; adjustments: Adjustment[]; canManage: boolean; inventoryName: (id: string) => string; onAdd: () => void; onEdit: (item: InventoryItem) => void; onPurchase: () => void; onAdjust: () => void }) {
  return <div className="space-y-6"><Card><div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Inventory Items</h2>{canManage && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={onPurchase}><Plus className="h-4 w-4" /> Purchase</Button><Button size="sm" variant="outline" onClick={onAdjust}><Hammer className="h-4 w-4" /> Adjust Stock</Button><Button size="sm" onClick={onAdd}><Boxes className="h-4 w-4" /> Add Item</Button></div>}</div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Item", "Category", "Quantity", "Reorder Level", "Supplier", "Value", "Actions"].map((label) => <th className="px-5 py-3.5" key={label}>{label}</th>)}</tr></thead><tbody>{inventory.map((item) => <tr className="border-t border-slate-100" key={item.id}><td className="px-5 py-4"><p className="font-bold text-navy">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.itemNumber}</p></td><td className="px-5 py-4 text-slate-600">{item.category || "-"}</td><td className="px-5 py-4"><StatusBadge tone={item.quantity <= item.reorderLevel ? "red" : "green"}>{item.quantity}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{item.reorderLevel}</td><td className="px-5 py-4 text-slate-600">{item.supplier || "-"}</td><td className="px-5 py-4 text-slate-600">{currency.format(item.quantity * item.unitCost)}</td><td className="px-5 py-4">{canManage && <Button size="sm" variant="ghost" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /> Edit</Button>}</td></tr>)}</tbody></table></div></Card><section className="grid gap-4 xl:grid-cols-2"><HistoryCard title="Purchase History" rows={purchases.map((purchase) => [inventoryName(purchase.inventoryItemId), purchase.purchaseDate, `${purchase.quantity} @ ${currency.format(purchase.unitCost)}`, purchase.supplier || "-"])} /><HistoryCard title="Stock Adjustments" rows={adjustments.map((adjustment) => [inventoryName(adjustment.inventoryItemId), adjustment.adjustmentDate, String(adjustment.quantityChange), adjustment.reason])} /></section></div>;
}

function HistoryCard({ title, rows }: { title: string; rows: string[][] }) {
  return <Card><div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">{title}</h2></div><div className="space-y-3 p-4">{rows.map((row, index) => <div className="rounded-lg border border-slate-100 p-3" key={`${row[0]}-${index}`}><p className="font-semibold text-navy">{row[0]}</p><p className="mt-1 text-xs text-slate-400">{row.slice(1).join(" · ")}</p></div>)}{rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No records found.</p>}</div></Card>;
}

function QrTab({ assets, scanCode, setScanCode, scannedAsset, onCheckOut }: { assets: Asset[]; scanCode: string; setScanCode: (value: string) => void; scannedAsset?: Asset; onCheckOut: (assetId: string) => void }) {
  return <div className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr]"><Card className="p-5"><h2 className="font-bold text-navy">Scan QR / Asset ID</h2><label className="mt-4 block text-sm font-semibold text-slate-700">Asset ID<input className={fieldClass} placeholder="AST-2026-001" value={scanCode} onChange={(event) => setScanCode(event.target.value)} /></label><p className="mt-3 text-xs leading-5 text-slate-400">Enter or scan an asset QR code to view asset details and start check-in/check-out workflows.</p></Card><Card className="p-5">{scannedAsset ? <div className="grid gap-5 md:grid-cols-[auto_1fr]"><AssetQr asset={scannedAsset} /><div><h2 className="text-xl font-bold text-navy">{scannedAsset.name}</h2><p className="mt-1 text-sm text-slate-500">{scannedAsset.assetNumber} · {scannedAsset.categoryName}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Serial Number" value={scannedAsset.serialNumber || "-"} /><Info label="Location" value={scannedAsset.location || "-"} /><Info label="Current Value" value={currency.format(scannedAsset.currentValue)} /><Info label="Status" value={titleCase(scannedAsset.status)} /></div><Button className="mt-4" disabled={scannedAsset.status !== "available"} onClick={() => onCheckOut(scannedAsset.id)}><LogOut className="h-4 w-4" /> Check Out Asset</Button></div></div> : <p className="py-12 text-center text-sm text-slate-500">No asset selected. Try one of: {assets.slice(0, 3).map((asset) => asset.assetNumber).join(", ") || "AST-2026-001"}.</p>}</Card></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy">{value}</p></div>;
}

function AssetModal({ form, setForm, categories, saving, onClose, onSubmit }: { form: Asset; setForm: (form: Asset) => void; categories: Category[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Asset Register" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><Input label="Asset ID" value={form.assetNumber} onChange={(value) => setForm({ ...form, assetNumber: value })} required /><Input label="Asset Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><label className="text-sm font-semibold text-slate-700">Category<select className={fieldClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Select category</option>{categories.map((category) => <option disabled={!category.isActive} key={category.id} value={category.id}>{category.name}</option>)}</select></label><Input label="Serial Number" value={form.serialNumber} onChange={(value) => setForm({ ...form, serialNumber: value })} /><Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={(value) => setForm({ ...form, purchaseDate: value })} /><Input label="Purchase Cost" type="number" value={String(form.purchaseCost)} onChange={(value) => setForm({ ...form, purchaseCost: Number(value) })} /><Input label="Current Value" type="number" value={String(form.currentValue)} onChange={(value) => setForm({ ...form, currentValue: Number(value) })} /><Input label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value as AssetStatus })} options={["available", "assigned", "in_use", "under_maintenance", "retired", "lost"]} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Asset" onClose={onClose} /></form></Modal>;
}

function InventoryModal({ form, setForm, saving, onClose, onSubmit }: { form: InventoryItem; setForm: (form: InventoryItem) => void; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const categoryOptions = form.category && !inventoryCategories.includes(form.category) ? [...inventoryCategories, form.category] : inventoryCategories;
  return <Modal title="Inventory Item" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><Input label="Item ID" value={form.itemNumber} onChange={(value) => setForm({ ...form, itemNumber: value })} required /><Input label="Item Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required /><label className="text-sm font-semibold text-slate-700">Category<select className={fieldClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Select category</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><Input label="Quantity" type="number" value={String(form.quantity)} onChange={(value) => setForm({ ...form, quantity: Number(value) })} /><Input label="Reorder Level" type="number" value={String(form.reorderLevel)} onChange={(value) => setForm({ ...form, reorderLevel: Number(value) })} /><Input label="Unit Cost" type="number" value={String(form.unitCost)} onChange={(value) => setForm({ ...form, unitCost: Number(value) })} /><Input label="Supplier" value={form.supplier} onChange={(value) => setForm({ ...form, supplier: value })} /><Input label="Location" value={form.location} onChange={(value) => setForm({ ...form, location: value })} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">Description<textarea className={textareaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Item" onClose={onClose} /></form></Modal>;
}

function AssignmentModal({ form, setForm, assets, members, departments, saving, onClose, onSubmit }: { form: typeof emptyAssignment; setForm: (form: typeof emptyAssignment) => void; assets: Asset[]; members: Option[]; departments: Option[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Assign Asset" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Asset<select className={fieldClass} required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })}><option value="">Select asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.assetNumber})</option>)}</select></label><Select label="Assignment Type" value={form.assignedToType} onChange={(value) => setForm({ ...form, assignedToType: value as AssignmentType, memberId: "", departmentId: "", profileId: "", assignedRole: "", assignedLocation: "" })} options={["member", "department", "church_role", "location"]} /><AssigneeSelect label="Member" disabled={form.assignedToType !== "member"} options={members} value={form.memberId} onChange={(value) => setForm({ ...form, memberId: value })} /><AssigneeSelect label="Department" disabled={form.assignedToType !== "department"} options={departments} value={form.departmentId} onChange={(value) => setForm({ ...form, departmentId: value })} /><label className="text-sm font-semibold text-slate-700">Church Role<select className={fieldClass} disabled={form.assignedToType !== "church_role"} value={form.assignedRole} onChange={(event) => setForm({ ...form, assignedRole: event.target.value })}><option value="">{form.assignedToType === "church_role" ? "Select church role" : "Choose church role type first"}</option>{APP_ROLES.filter((role) => role !== "member").map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label><Input label="Location" value={form.assignedLocation} onChange={(value) => setForm({ ...form, assignedLocation: value })} disabled={form.assignedToType !== "location"} placeholder={form.assignedToType === "location" ? "Sanctuary, Media room, Office..." : "Choose location type first"} /><Input label="Check Out Date" type="datetime-local" value={form.checkedOutAt} onChange={(value) => setForm({ ...form, checkedOutAt: value })} required /><Input label="Expected Return Date" type="date" value={form.expectedReturnDate} onChange={(value) => setForm({ ...form, expectedReturnDate: value })} /><Input label="Condition" value={form.conditionOut} onChange={(value) => setForm({ ...form, conditionOut: value })} placeholder="Good, needs cable, minor scratches..." /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><ModalActions saving={saving} label="Assign Asset" onClose={onClose} /></form></Modal>;
}

function MaintenanceModal({ form, setForm, assets, saving, onClose, onSubmit }: { form: typeof emptyMaintenance; setForm: (form: typeof emptyMaintenance) => void; assets: Asset[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Maintenance Record" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Asset<select className={fieldClass} required value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })}><option value="">Select asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label><Input label="Maintenance Date" type="date" value={form.maintenanceDate} onChange={(value) => setForm({ ...form, maintenanceDate: value })} /><Input label="Maintenance Type" value={form.maintenanceType} onChange={(value) => setForm({ ...form, maintenanceType: value })} /><Input label="Service Provider" value={form.serviceProvider} onChange={(value) => setForm({ ...form, serviceProvider: value })} /><Input label="Maintenance Cost" type="number" value={String(form.maintenanceCost)} onChange={(value) => setForm({ ...form, maintenanceCost: Number(value) })} /><Input label="Next Maintenance Date" type="date" value={form.nextMaintenanceDate} onChange={(value) => setForm({ ...form, nextMaintenanceDate: value })} /><Select label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["scheduled", "in_progress", "completed", "cancelled"]} /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Maintenance" onClose={onClose} /></form></Modal>;
}

function PurchaseModal({ form, setForm, inventory, saving, onClose, onSubmit }: { form: typeof emptyPurchase; setForm: (form: typeof emptyPurchase) => void; inventory: InventoryItem[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Record Purchase" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Inventory Item<select className={fieldClass} required value={form.inventoryItemId} onChange={(event) => setForm({ ...form, inventoryItemId: event.target.value })}><option value="">Select item</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={(value) => setForm({ ...form, purchaseDate: value })} /><Input label="Quantity" type="number" value={String(form.quantity)} onChange={(value) => setForm({ ...form, quantity: Number(value) })} /><Input label="Unit Cost" type="number" value={String(form.unitCost)} onChange={(value) => setForm({ ...form, unitCost: Number(value) })} /><Input label="Supplier" value={form.supplier} onChange={(value) => setForm({ ...form, supplier: value })} /><Input label="Receipt Reference" value={form.receiptReference} onChange={(value) => setForm({ ...form, receiptReference: value })} /></div><ModalActions saving={saving} label="Save Purchase" onClose={onClose} /></form></Modal>;
}

function AdjustmentModal({ form, setForm, inventory, saving, onClose, onSubmit }: { form: typeof emptyAdjustment; setForm: (form: typeof emptyAdjustment) => void; inventory: InventoryItem[]; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="Stock Adjustment" onClose={onClose}><form onSubmit={onSubmit}><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Inventory Item<select className={fieldClass} required value={form.inventoryItemId} onChange={(event) => setForm({ ...form, inventoryItemId: event.target.value })}><option value="">Select item</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Input label="Quantity Change" type="number" value={String(form.quantityChange)} onChange={(value) => setForm({ ...form, quantityChange: Number(value) })} /><Input label="Reason" value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} required /><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className={textareaClass} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><ModalActions saving={saving} label="Save Adjustment" onClose={onClose} /></form></Modal>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5"><div><h2 className="font-bold text-navy">{title}</h2><p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church asset records</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close form" onClick={onClose}><X className="h-5 w-5" /></Button></div>{children}</div></div>;
}

function ModalActions({ saving, label, onClose }: { saving: boolean; label: string; onClose: () => void }) {
  return <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : label}</Button></div>;
}

function Input({ label, value, onChange, type = "text", required = false, disabled = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; placeholder?: string }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<input className={fieldClass} disabled={disabled} placeholder={placeholder} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}</select></label>;
}

function AssigneeSelect({ label, disabled, options, value, onChange }: { label: string; disabled: boolean; options: Option[]; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<select className={fieldClass} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{disabled ? "Choose matching assignment type first" : `Select ${label.toLowerCase()}`}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}
