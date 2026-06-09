"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft, BadgeEuro, BarChart3, BookOpenCheck, CircleDollarSign,
  Download, FileSpreadsheet, Landmark, MessageCircle, Pencil, Plus, RotateCw, Search, Trash2, WalletCards, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/language-provider";
import { normalizeRoles } from "@/lib/auth";
import {
  FINANCE_ACCOUNT_TYPES,
  FINANCE_REPORTS,
  type FinanceAccountType,
  type FinanceReport,
} from "@/lib/types";
import { positiveNumber, required } from "@/lib/validation";
import type { TranslationKey } from "@/lib/i18n";

type FinanceTab = "dashboard" | "add" | "history" | "statement" | "monthly" | "quarterly" | "annual" | "accounts" | "subaccounts" | "transactions" | "reports" | "cash" | "bank" | "income" | "whatsapp";
type AccountStatus = "Active" | "Inactive";
type StoredTransactionType = "Income" | "Expenditure" | "Transfer" | "Expense" | "Tithe" | "Offering" | "Thanksgiving" | "Building Fund" | "Mission Offering" | "Welfare Fund" | "Special Donations" | "Donation" | "Other" | "Other Church Payment";
type FinanceSubAccountGroup = "Income" | "Expenditure";
type PaymentMethod = string;
type Account = {
  id: string;
  name: string;
  accountType: FinanceAccountType;
  openingBalance: number;
  currentBalance: number;
  description: string;
  status: AccountStatus;
};
type Category = { id: string; name: string; type: StoredTransactionType; group: FinanceSubAccountGroup; description: string; isActive: boolean };
type Transaction = {
  id: string;
  date: string;
  type: StoredTransactionType;
  accountId: string;
  accountName: string;
  memberId: string;
  memberName: string;
  transferToAccountId: string;
  transferToAccountName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: string;
  description: string;
  paymentMethod: PaymentMethod;
  notes: string;
  reference: string;
  whatsappStatus: string;
  whatsappError: string;
  enteredBy: string;
};
type AccountForm = Omit<Account, "id" | "currentBalance">;
type CategoryForm = { name: string; group: FinanceSubAccountGroup; description: string; isActive: boolean };
type TransactionForm = {
  date: string;
  type: FinanceSubAccountGroup;
  accountId: string;
  memberId: string;
  transferToAccountId: string;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string;
  reference: string;
};
type MemberOption = { id: string; memberNumber: string; name: string; phone: string };
type PaymentNotificationLog = { id: string; memberId: string; paymentId: string; phoneNumber: string; message: string; status: string; errorMessage: string; sentAt: string; createdAt: string };
type WhatsAppSettings = { phoneNumberId: string; accessToken: string; defaultTemplateName: string; templateLanguage: string; autoNotificationsEnabled: boolean; accessTokenConfigured: boolean };

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const tabs: { id: FinanceTab; label: string }[] = [
  { id: "dashboard", label: "Contributions Dashboard" },
  { id: "add", label: "Record Contribution" },
  { id: "history", label: "Contribution History" },
  { id: "statement", label: "Member Statement" },
  { id: "monthly", label: "Monthly Report" },
  { id: "quarterly", label: "Quarterly Report" },
  { id: "annual", label: "Annual Report" },
  { id: "accounts", label: "Accounts" },
  { id: "subaccounts", label: "Sub-Accounts" },
  { id: "transactions", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "cash", label: "Cash Account" },
  { id: "bank", label: "Bank Account" },
  { id: "income", label: "Income & Expenditure" },
  { id: "whatsapp", label: "WhatsApp Receipts" },
];
const financeTranslationKeys: Record<string, TranslationKey> = {
  "Tithe": "finance.tithe",
  "Offering": "finance.offering",
  "Thanksgiving": "finance.thanksgiving",
  "Income": "finance.income",
  "Expenditure": "finance.expenditure",
  "Cash Account": "finance.cashAccount",
  "Bank Account": "finance.bankAccount",
  "Balance": "finance.balance",
  "Receipt": "finance.receipt",
  "Payments": "finance.payments",
  "Accounts": "finance.accounts",
  "Reports": "finance.reports",
  "Building Fund": "finance.buildingFund",
  "Special Donations": "finance.donation",
  "Welfare Fund": "finance.welfare",
  "Other": "finance.other",
};
const defaultAccounts: Account[] = [
  { id: "cash", name: "Cash Account", accountType: "Asset", openingBalance: 0, currentBalance: 0, description: "Physical cash handled by treasury.", status: "Active" },
  { id: "bank", name: "Bank Account", accountType: "Asset", openingBalance: 0, currentBalance: 0, description: "Primary church bank account.", status: "Active" },
  { id: "tithe", name: "Tithe Account", accountType: "Fund", openingBalance: 0, currentBalance: 0, description: "Dedicated tithe account.", status: "Active" },
  { id: "offering", name: "Offering Account", accountType: "Income", openingBalance: 0, currentBalance: 0, description: "Sabbath offerings account.", status: "Active" },
  { id: "building", name: "Building Fund Account", accountType: "Fund", openingBalance: 0, currentBalance: 0, description: "Building fund account.", status: "Active" },
  { id: "mission", name: "Mission Fund Account", accountType: "Fund", openingBalance: 0, currentBalance: 0, description: "Mission fund account.", status: "Active" },
  { id: "donations", name: "Donations Account", accountType: "Income", openingBalance: 0, currentBalance: 0, description: "Special donations account.", status: "Active" },
  { id: "welfare", name: "Welfare Account", accountType: "Fund", openingBalance: 0, currentBalance: 0, description: "Welfare and benevolence account.", status: "Active" },
  { id: "expenses", name: "Expenses Account", accountType: "Expense", openingBalance: 0, currentBalance: 0, description: "General expenses account.", status: "Active" },
];
const emptyAccount: AccountForm = { name: "", accountType: "Income", openingBalance: 0, description: "", status: "Active" };
const emptyCategory: CategoryForm = { name: "", group: "Income", description: "", isActive: true };
const emptyTransaction: TransactionForm = {
  date: new Date().toISOString().slice(0, 10),
  type: "Income",
  accountId: "",
  memberId: "",
  transferToAccountId: "",
  categoryId: "",
  amount: 0,
  paymentMethod: "Cash",
  notes: "",
  reference: "",
};
const defaultPaymentMethods: PaymentMethod[] = ["Cash", "Bank Transfer", "Card", "Mobile Money", "Other"];

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function labelize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function enumize(value: string) {
  if (value === "Other") return "other";
  return value.toLowerCase().replaceAll(" ", "_");
}

function categoryGroup(value: string): FinanceSubAccountGroup {
  return ["Expenditure", "Expense"].includes(labelize(value)) ? "Expenditure" : "Income";
}

function categoryTypeForGroup(group: FinanceSubAccountGroup) {
  return group === "Expenditure" ? "expense" : "income";
}

function receiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `HG-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function relatedName(value: unknown) {
  if (!value) return "";
  if (Array.isArray(value)) return String((value[0] as { name?: unknown; full_name?: unknown } | undefined)?.name ?? (value[0] as { full_name?: unknown } | undefined)?.full_name ?? "");
  return String((value as { name?: unknown; full_name?: unknown }).name ?? (value as { full_name?: unknown }).full_name ?? "");
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function signedAmount(transaction: Transaction) {
  return ["Expenditure", "Expense"].includes(transaction.type) ? -transaction.amount : transaction.amount;
}

function contributionLabel(transaction: Transaction) {
  return transaction.categoryName || transaction.type;
}

function matchesCategory(transaction: Transaction, category: string) {
  return contributionLabel(transaction) === category;
}

function transactionQuarter(date: string) {
  const month = Number(date.slice(5, 7));
  return Math.max(1, Math.ceil(month / 3));
}

type RawFinanceMember = {
  id: string;
  member_id?: string | null;
  member_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function financeMemberName(member: RawFinanceMember) {
  return member.full_name || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email || "Unnamed Member";
}

function financeMemberNumber(member: RawFinanceMember) {
  return member.member_id || member.member_number || member.id.slice(0, 8).toUpperCase();
}

async function loadActiveFinanceMembers(supabase: NonNullable<ReturnType<typeof createClient>>) {
  const selects = [
    "id, member_id, first_name, last_name, full_name, email, phone",
    "id, member_number, first_name, last_name, full_name, email, phone",
    "id, full_name, email, phone",
  ];

  let lastError = "";
  for (const columns of selects) {
    const result = await supabase.from("members").select(columns).eq("status", "active").order("full_name");
    if (!result.error) return { members: (result.data ?? []) as unknown as RawFinanceMember[], error: "" };
    lastError = result.error.message;
  }

  return { members: [] as RawFinanceMember[], error: lastError };
}

export function FinanceManagement({ initialTab = "dashboard" }: { initialTab?: FinanceTab }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(defaultPaymentMethods);
  const [notificationLogs, setNotificationLogs] = useState<PaymentNotificationLog[]>([]);
  const [settingsForm, setSettingsForm] = useState<WhatsAppSettings>({ phoneNumberId: "", accessToken: "", defaultTemplateName: "payment_receipt", templateLanguage: "en", autoNotificationsEnabled: false, accessTokenConfigured: false });
  const [whatsappConfigured, setWhatsappConfigured] = useState(true);
  const [query, setQuery] = useState("");
  const [statementMemberId, setStatementMemberId] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [report, setReport] = useState<FinanceReport>("Income and Expenditure");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTreasurer, setIsTreasurer] = useState(false);
  const [canManageContributions, setCanManageContributions] = useState(false);
  const [canManageSubAccounts, setCanManageSubAccounts] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionForm | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    async function loadFinance() {
      const supabase = createClient();
      if (!supabase) {
        setAccounts(defaultAccounts);
        setLoading(false);
        setIsTreasurer(true);
        setCanManageContributions(true);
        setCanManageSubAccounts(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const roleNames = normalizeRoles((roleRows ?? []).map(({ role }) => role));
        setIsTreasurer(roleNames.includes("treasurer"));
        setCanManageContributions(roleNames.some((role) => role === "treasurer" || role === "super_admin"));
        setCanManageSubAccounts(roleNames.some((role) => role === "treasurer" || role === "super_admin"));
      }

      const [accountResult, categoryResult, memberResult, logResult, transactionResult, paymentMethodResult] = await Promise.all([
        supabase.from("finance_accounts").select("*").order("name"),
        supabase.from("finance_categories").select("*").order("name"),
        loadActiveFinanceMembers(supabase),
        supabase.from("whatsapp_payment_notification_logs").select("*").order("created_at", { ascending: false }),
        supabase
          .from("finance_transactions")
          .select("*, account:finance_accounts!finance_transactions_account_id_fkey(name), transfer_account:finance_accounts!finance_transactions_transfer_to_account_id_fkey(name), finance_categories(name), members(full_name), recorded_by_profile:profiles!finance_transactions_recorded_by_fkey(full_name)")
          .order("transaction_date", { ascending: false }),
        supabase.from("record_settings").select("name, is_active").eq("setting_group", "payment_method").order("sort_order").order("name"),
      ]);

      if (accountResult.error) {
        setError(`Finance accounting tables are not available yet: ${accountResult.error.message}. Apply migration 202606030001_finance_accounting_system.sql in Supabase.`);
        setAccounts(defaultAccounts);
        setLoading(false);
        return;
      }

      setAccounts((accountResult.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        accountType: labelize(row.account_type) as FinanceAccountType,
        openingBalance: Number(row.opening_balance),
        currentBalance: Number(row.current_balance),
        description: row.description ?? "",
        status: labelize(row.status) as AccountStatus,
      })));
      setCategories((categoryResult.data ?? []).map((row) => ({ id: row.id, name: row.name, type: labelize(row.type) as StoredTransactionType, group: categoryGroup(row.type), description: row.description ?? "", isActive: Boolean(row.is_active) })));
      if (!paymentMethodResult.error && paymentMethodResult.data?.length) {
        const activeMethods = paymentMethodResult.data.filter((row) => row.is_active).map((row) => row.name);
        if (activeMethods.length) setPaymentMethods(activeMethods);
      }
      if (memberResult.error) setError(`Unable to load active members for finance payments: ${memberResult.error}`);
      setMembers(memberResult.members.map((row) => ({ id: row.id, memberNumber: financeMemberNumber(row), name: financeMemberName(row), phone: row.phone ?? "" })));
      const logs = (logResult.data ?? []).map((row) => ({
        id: row.id,
        memberId: row.member_id ?? "",
        paymentId: row.payment_id ?? "",
        phoneNumber: row.phone_number,
        message: row.message,
        status: labelize(row.status),
        errorMessage: row.error_message ?? "",
        sentAt: row.sent_at ?? "",
        createdAt: row.created_at,
      }));
      setNotificationLogs(logs);
      const logByPayment = new Map(logs.map((log) => [log.paymentId, log]));
      setTransactions((transactionResult.data ?? []).map((row) => ({
        id: row.id,
        date: row.transaction_date,
        type: labelize(row.transaction_type) as StoredTransactionType,
        accountId: row.account_id,
        accountName: relatedName(row.account),
        memberId: row.member_id ?? "",
        memberName: relatedName(row.members),
        transferToAccountId: row.transfer_to_account_id ?? "",
        transferToAccountName: relatedName(row.transfer_account),
        categoryId: row.category_id ?? "",
        categoryName: relatedName(row.finance_categories),
        amount: Number(row.amount),
        currency: row.currency ?? "EUR",
        description: row.description,
        paymentMethod: labelize(row.payment_method) as PaymentMethod,
        notes: row.notes ?? "",
        reference: row.reference_number ?? "",
        whatsappStatus: logByPayment.get(row.id)?.status ?? "Not Sent",
        whatsappError: logByPayment.get(row.id)?.errorMessage ?? "",
        enteredBy: relatedName(row.recorded_by_profile) || "Church Treasurer",
      })));
      const settingsResponse = await fetch("/api/whatsapp/payment-settings");
      if (settingsResponse.ok) {
        const { settings, notConfigured } = await settingsResponse.json();
        setWhatsappConfigured(!notConfigured);
        if (settings) setSettingsForm({
          phoneNumberId: settings.phone_number_id ?? "",
          accessToken: "",
          defaultTemplateName: settings.default_template_name ?? "payment_receipt",
          templateLanguage: settings.template_language ?? "en",
          autoNotificationsEnabled: Boolean(settings.auto_notifications_enabled),
          accessTokenConfigured: Boolean(settings.access_token_configured),
        });
      } else {
        setWhatsappConfigured(false);
      }
      setLoading(false);
    }
    loadFinance();
  }, []);

  const income = transactions.filter(({ type }) => ["Income", "Tithe", "Offering", "Building Fund", "Mission Offering", "Donation", "Welfare", "Other", "Other Church Payment"].includes(type)).reduce((sum, item) => sum + item.amount, 0);
  const expenditure = transactions.filter(({ type }) => ["Expenditure", "Expense"].includes(type)).reduce((sum, item) => sum + item.amount, 0);
  const accessMessage = isTreasurer
    ? "Finance management access: you can add, modify, delete, search, export, generate receipts, and manage finance sub-accounts."
    : canManageSubAccounts
      ? "Contribution management access: Super Admin can add, edit, search, export, generate receipts, and manage income and expenditure sub-accounts."
      : "Read-only finance access: you can view payments and reports, but only authorized finance managers can add, edit, or delete payments.";
  const filteredTransactions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return transactions.filter((item) => !normalized || Object.values(item).some((value) => String(value).toLowerCase().includes(normalized)));
  }, [query, transactions]);
  const monthly = useMemo(() => {
    const rows = new Map<string, { income: number; expenditure: number }>();
    transactions.forEach((item) => {
      const key = monthKey(item.date);
      const current = rows.get(key) ?? { income: 0, expenditure: 0 };
      if (signedAmount(item) >= 0 && item.type !== "Transfer") current.income += item.amount;
      if (signedAmount(item) < 0) current.expenditure += item.amount;
      rows.set(key, current);
    });
    return [...rows.entries()].sort(([left], [right]) => right.localeCompare(left)).slice(0, 12);
  }, [transactions]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear().toString();
  const currentQuarter = transactionQuarter(new Date().toISOString().slice(0, 10));
  const availableYears = useMemo(() => {
    const years = [...new Set(transactions.map((item) => item.date.slice(0, 4)))].sort((left, right) => right.localeCompare(left));
    return years.length ? years : [currentYear];
  }, [currentYear, transactions]);
  const financeCategories = useMemo(() => ["All Categories", ...new Set(transactions.map(contributionLabel).filter(Boolean))], [transactions]);
  const filteredByYearCategory = useMemo(() => filteredTransactions.filter((item) =>
    (!selectedYear || item.date.startsWith(selectedYear))
    && (selectedCategory === "All Categories" || matchesCategory(item, selectedCategory))
  ), [filteredTransactions, selectedCategory, selectedYear]);
  const monthlyTransactions = filteredTransactions.filter((item) => item.date.startsWith(currentMonth));
  const quarterlyTransactions = filteredTransactions.filter((item) => item.date.startsWith(currentYear) && transactionQuarter(item.date) === currentQuarter);
  const annualTransactions = filteredTransactions.filter((item) => item.date.startsWith(selectedYear));
  const statementRows = filteredByYearCategory.filter((item) => !statementMemberId || item.memberId === statementMemberId);
  const totalTitheThisMonth = monthlyTransactions.filter((item) => (item.categoryName || item.type) === "Tithe").reduce((sum, item) => sum + item.amount, 0);
  const totalOfferingsThisMonth = monthlyTransactions.filter((item) => ["Offering", "Sabbath Offering"].includes(item.categoryName || item.type)).reduce((sum, item) => sum + item.amount, 0);
  const totalDonationsThisMonth = monthlyTransactions.filter((item) => ["Thanksgiving", "Special Donation", "Special Donations", "Other", "Donation"].includes(item.categoryName || item.type)).reduce((sum, item) => sum + item.amount, 0);
  const memberTotals = useMemo(() => groupTotals(filteredByYearCategory, (item) => item.memberName || "Unassigned"), [filteredByYearCategory]);
  const chartCategories = categories.filter((category) => category.group === "Income").slice(0, 4).map((category) => category.name);
  const chartTotals = chartCategories.map((category) => ({ category, value: filteredByYearCategory.filter((item) => matchesCategory(item, category)).reduce((sum, item) => sum + item.amount, 0) }));
  const incomeSubAccountTotals = useMemo(() => groupTotals(filteredByYearCategory.filter((item) => !["Expenditure", "Expense"].includes(item.type)), contributionLabel), [filteredByYearCategory]);
  const expenditureSubAccountTotals = useMemo(() => groupTotals(filteredByYearCategory.filter((item) => ["Expenditure", "Expense"].includes(item.type)), contributionLabel), [filteredByYearCategory]);
  const paymentMethodTotals = useMemo(() => groupTotals(filteredByYearCategory, (item) => item.paymentMethod || "Unspecified"), [filteredByYearCategory]);
  const monthTotals = useMemo(() => groupTotals(filteredByYearCategory, (item) => monthKey(item.date)), [filteredByYearCategory]);
  const reportRows = activeTab === "monthly" ? monthlyTransactions : activeTab === "quarterly" ? quarterlyTransactions : activeTab === "annual" ? annualTransactions : activeTab === "statement" ? statementRows : filteredByYearCategory;

  function openAccount(account?: Account) {
    if (!isTreasurer) return;
    setEditingAccount(account ?? null);
    setAccountForm(account ? {
      name: account.name,
      accountType: account.accountType,
      openingBalance: account.openingBalance,
      description: account.description,
      status: account.status,
    } : emptyAccount);
  }

  function openTransaction(transaction?: Transaction) {
    if (!canManageContributions) {
      setError("Access denied: only Treasurer or Admin can edit contribution records.");
      return;
    }
    const selectedCategory = categories.find((category) => category.id === transaction?.categoryId);
    setNotice("");
    setError("");
    setEditingTransaction(transaction ?? null);
    setTransactionForm(transaction ? {
      date: transaction.date,
      type: selectedCategory?.group ?? categoryGroup(transaction.type),
      accountId: transaction.accountId,
      memberId: transaction.memberId,
      transferToAccountId: transaction.transferToAccountId,
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      notes: transaction.notes,
      reference: transaction.reference,
    } : { ...emptyTransaction, accountId: accounts[0]?.id ?? "", categoryId: categories.find((category) => category.isActive && category.group === "Income")?.id ?? "" });
  }

  function handleEdit(transaction: Transaction) {
    openTransaction(transaction);
  }

  function openCategory(category?: Category) {
    if (!canManageSubAccounts) return;
    setEditingCategory(category ?? null);
    setCategoryForm(category ? {
      name: category.name,
      group: category.group,
      description: category.description,
      isActive: category.isActive,
    } : emptyCategory);
  }

  async function reloadAfterWrite() {
    const supabase = createClient();
    if (!supabase) return;
    const [{ data: accountRows }, { data: categoryRows }, { data: logRows }, { data: transactionRows }] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("name"),
      supabase.from("finance_categories").select("*").order("name"),
      supabase.from("whatsapp_payment_notification_logs").select("*").order("created_at", { ascending: false }),
      supabase.from("finance_transactions").select("*, account:finance_accounts!finance_transactions_account_id_fkey(name), transfer_account:finance_accounts!finance_transactions_transfer_to_account_id_fkey(name), finance_categories(name), members(full_name), recorded_by_profile:profiles!finance_transactions_recorded_by_fkey(full_name)").order("transaction_date", { ascending: false }),
    ]);
    setAccounts((accountRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      accountType: labelize(row.account_type) as FinanceAccountType,
      openingBalance: Number(row.opening_balance),
      currentBalance: Number(row.current_balance),
      description: row.description ?? "",
      status: labelize(row.status) as AccountStatus,
    })));
    setCategories((categoryRows ?? []).map((row) => ({ id: row.id, name: row.name, type: labelize(row.type) as StoredTransactionType, group: categoryGroup(row.type), description: row.description ?? "", isActive: Boolean(row.is_active) })));
    const logs = (logRows ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id ?? "",
      paymentId: row.payment_id ?? "",
      phoneNumber: row.phone_number,
      message: row.message,
      status: labelize(row.status),
      errorMessage: row.error_message ?? "",
      sentAt: row.sent_at ?? "",
      createdAt: row.created_at,
    }));
    setNotificationLogs(logs);
    const logByPayment = new Map(logs.map((log) => [log.paymentId, log]));
    setTransactions((transactionRows ?? []).map((row) => ({
      id: row.id,
      date: row.transaction_date,
      type: labelize(row.transaction_type) as StoredTransactionType,
      accountId: row.account_id,
      accountName: relatedName(row.account),
      memberId: row.member_id ?? "",
      memberName: relatedName(row.members),
      transferToAccountId: row.transfer_to_account_id ?? "",
      transferToAccountName: relatedName(row.transfer_account),
      categoryId: row.category_id ?? "",
      categoryName: relatedName(row.finance_categories),
      amount: Number(row.amount),
      currency: row.currency ?? "EUR",
      description: row.description,
      paymentMethod: labelize(row.payment_method) as PaymentMethod,
      notes: row.notes ?? "",
      reference: row.reference_number ?? "",
      whatsappStatus: logByPayment.get(row.id)?.status ?? "Not Sent",
      whatsappError: logByPayment.get(row.id)?.errorMessage ?? "",
      enteredBy: relatedName(row.recorded_by_profile) || "Church Treasurer",
    })));
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountForm || !isTreasurer) return;
    const validationError = required(accountForm.name, "Account name");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = {
        name: accountForm.name,
        account_type: enumize(accountForm.accountType),
        opening_balance: Number(accountForm.openingBalance),
        current_balance: editingAccount ? undefined : Number(accountForm.openingBalance),
        description: accountForm.description || null,
        status: enumize(accountForm.status),
      };
      const request = editingAccount
        ? supabase.from("finance_accounts").update(payload).eq("id", editingAccount.id)
        : supabase.from("finance_accounts").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      await reloadAfterWrite();
    }
    setNotice(editingAccount ? "Account updated." : "New account created.");
    setError("");
    setSaving(false);
    setAccountForm(null);
    setEditingAccount(null);
  }

  async function deleteAccount(account: Account) {
    if (!isTreasurer) return;
    if (!window.confirm(`Delete ${account.name}? Accounts with transactions cannot be removed.`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("finance_accounts").delete().eq("id", account.id);
      if (deleteError) { setError(deleteError.message); return; }
      await reloadAfterWrite();
    }
    setNotice("Account deleted.");
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryForm || !canManageSubAccounts) return;
    const validationError = required(categoryForm.name, "Sub-account name");
    if (validationError) { setError(validationError); return; }
    const duplicate = categories.find((category) => category.id !== editingCategory?.id && category.name.trim().toLowerCase() === categoryForm.name.trim().toLowerCase());
    if (duplicate) { setError(`A finance sub-account named "${categoryForm.name.trim()}" already exists.`); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const payload = {
        name: categoryForm.name.trim(),
        type: categoryTypeForGroup(categoryForm.group),
        description: categoryForm.description || null,
        is_active: categoryForm.isActive,
        created_by: editingCategory ? undefined : currentUserId || null,
        updated_by: currentUserId || null,
      };
      const request = editingCategory
        ? supabase.from("finance_categories").update(payload).eq("id", editingCategory.id)
        : supabase.from("finance_categories").insert(payload);
      const { error: saveError } = await request;
      if (saveError) { setError(saveError.message); setSaving(false); return; }
      await reloadAfterWrite();
    } else {
      const next: Category = { id: editingCategory?.id ?? crypto.randomUUID(), name: categoryForm.name.trim(), type: categoryForm.group, group: categoryForm.group, description: categoryForm.description, isActive: categoryForm.isActive };
      setCategories((current) => editingCategory ? current.map((item) => item.id === editingCategory.id ? next : item) : [...current, next]);
    }
    setNotice(editingCategory ? "Finance sub-account updated." : "Finance sub-account created.");
    setError("");
    setSaving(false);
    setCategoryForm(null);
    setEditingCategory(null);
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transactionForm) return;
    if (!canManageContributions) {
      setError("Access denied: only Treasurer or Admin can save contribution records.");
      return;
    }
    const selectedCategory = categories.find((category) => category.id === transactionForm.categoryId);
    const validationError = required(transactionForm.accountId, "Account") || required(transactionForm.categoryId, "Finance sub-account") || required(transactionForm.paymentMethod, "Payment method") || positiveNumber(Number(transactionForm.amount), "Amount");
    if (validationError) { setError(validationError); return; }
    if (!selectedCategory) { setError("Select a valid finance sub-account."); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const generatedReference = transactionForm.reference || receiptNumber();
      const description = transactionForm.notes || `${selectedCategory.name} ${selectedCategory.group.toLowerCase()}`;
      const payload = {
        transaction_date: transactionForm.date,
        transaction_type: categoryTypeForGroup(selectedCategory.group),
        account_id: transactionForm.accountId,
        member_id: transactionForm.memberId || null,
        transfer_to_account_id: null,
        category_id: selectedCategory.id,
        amount: Number(transactionForm.amount),
        currency: "EUR",
        description,
        payment_method: enumize(transactionForm.paymentMethod),
        notes: transactionForm.notes || null,
        reference_number: generatedReference,
        recorded_by: user?.id ?? null,
      };
      const request = editingTransaction
        ? supabase.from("finance_transactions").update(payload).eq("id", editingTransaction.id).select("id").single()
        : supabase.from("finance_transactions").insert(payload).select("id").single();
      const { data: savedPayment, error: saveError } = await request;
      if (saveError) {
        setError(`${saveError.message}. Check that RLS allows Treasurer/Admin to update finance_transactions and that migration 202606090004_contributions_management.sql has been applied.`);
        setSaving(false);
        return;
      }
      if (!editingTransaction && transactionForm.memberId && savedPayment?.id) {
        const response = await fetch("/api/whatsapp/payment-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: savedPayment.id }),
        });
        const result = await response.json();
        if (result.notConfigured) setNotice("Payment saved. WhatsApp integration not configured yet.");
        else if (!response.ok) setNotice(`Payment saved. WhatsApp notification was not sent: ${result.error || "Unknown error"}`);
        else if (result.skipped) setNotice("Payment saved. WhatsApp notification queued as pending because auto notifications are disabled.");
        else setNotice("Payment saved and WhatsApp receipt processed.");
      }
      await reloadAfterWrite();
    }
    setNotice((current) => current || (editingTransaction ? "Payment updated successfully." : "Payment recorded successfully."));
    setError("");
    setSaving(false);
    setTransactionForm(null);
    setEditingTransaction(null);
  }

  async function handleDelete(transactionId: string) {
    if (!canManageContributions) {
      setError("Access denied: only Treasurer or Admin can delete contribution records.");
      return;
    }
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      setError("Contribution record was not found. Refresh the page and try again.");
      return;
    }
    if (!window.confirm(`Delete payment ${transaction.reference || transaction.description}?`)) return;
    setNotice("");
    setError("");
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("finance_transactions").delete().eq("id", transactionId);
      if (deleteError) {
        setError(`${deleteError.message}. Check that RLS allows Treasurer/Admin to delete finance_transactions.`);
        return;
      }
      await reloadAfterWrite();
    } else {
      setTransactions((current) => current.filter((item) => item.id !== transactionId));
    }
    setNotice("Payment deleted successfully.");
  }

  async function saveWhatsAppSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/whatsapp/payment-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: settingsForm.phoneNumberId,
        accessToken: settingsForm.accessToken,
        defaultTemplateName: settingsForm.defaultTemplateName,
        templateLanguage: settingsForm.templateLanguage,
        autoNotificationsEnabled: settingsForm.autoNotificationsEnabled,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Unable to save WhatsApp settings.");
      return;
    }
    setSettingsForm((current) => ({ ...current, accessToken: "", accessTokenConfigured: current.accessTokenConfigured || Boolean(current.accessToken) }));
    setNotice("WhatsApp payment notification settings saved.");
    setError("");
  }

  async function retryNotification(paymentId: string) {
    if (!isTreasurer) return;
    const response = await fetch("/api/whatsapp/payment-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, retry: true }),
    });
    const result = await response.json();
    if (result.notConfigured) {
      setNotice("WhatsApp integration not configured yet.");
      await reloadAfterWrite();
    } else if (!response.ok) setError(result.error || "Unable to retry WhatsApp notification.");
    else {
      setNotice("WhatsApp payment notification retried.");
      await reloadAfterWrite();
    }
  }

  async function exportPdf() {
    const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const document = new jsPDF({ orientation: "landscape" });
    const selectedMember = members.find((member) => member.id === statementMemberId);
    const title = activeTab === "statement" ? `Annual Contribution Statement - ${selectedMember?.name ?? "All Members"}` : `${report} Report`;
    document.setFontSize(16);
    document.text("Hamburg Ghana SDA Church", 14, 14);
    document.setFontSize(10);
    document.text(`${title} | Year: ${selectedYear} | Category: ${selectedCategory}`, 14, 21);
    autoTableModule.default(document, {
      startY: 28,
      head: [["Date", "Member", "Sub-Account", "Account", "Payment Method", "Entered By", "Reference", "Amount"]],
      body: reportRows.map((item) => [item.date, item.memberName || "-", contributionLabel(item), item.accountName, item.paymentMethod, item.enteredBy, item.reference, currency.format(item.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`Hamburg-Ghana-SDA-${title.replaceAll(" ", "-")}-${selectedYear}.pdf`);
  }

  function exportExcel() {
    const headers = ["Date", "Member", "Group", "Sub-Account", "Account", "Payment Method", "Currency", "Entered By", "Reference", "Amount"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = reportRows.map((item) => row([item.date, item.memberName || "-", item.type, contributionLabel(item), item.accountName, item.paymentMethod, item.currency, item.enteredBy, item.reference, String(item.amount)]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Finance"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hamburg-Ghana-SDA-${report.replaceAll(" ", "-")}-${selectedYear}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const accountRows = activeTab === "cash" ? accounts.filter(({ name }) => name.toLowerCase().includes("cash")) : activeTab === "bank" ? accounts.filter(({ name }) => name.toLowerCase().includes("bank")) : accounts;
  const transactionRows = activeTab === "cash" ? filteredTransactions.filter(({ accountName, transferToAccountName }) => `${accountName} ${transferToAccountName}`.toLowerCase().includes("cash")) : activeTab === "bank" ? filteredTransactions.filter(({ accountName, transferToAccountName }) => `${accountName} ${transferToAccountName}`.toLowerCase().includes("bank")) : filteredTransactions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Tithe & Offerings Management" description="Record member tithe, Sabbath offerings, building fund, thanksgiving, and special donations." />
        <StatusBadge tone={canManageContributions ? "green" : canManageSubAccounts ? "blue" : "slate"}>{canManageContributions ? "Contribution management access" : canManageSubAccounts ? "Sub-account access" : "Read-only access"}</StatusBadge>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-100 bg-white p-2 shadow-card">
        {tabs.map((tab) => <Button key={tab.id} size="sm" variant={activeTab === tab.id ? "default" : "ghost"} onClick={() => setActiveTab(tab.id)}>{ft(tab.label)}</Button>)}
      </div>

      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <div className={`rounded-lg px-4 py-3 text-sm font-medium ${canManageContributions ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{accessMessage}</div>
      {!whatsappConfigured && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">WhatsApp integration not configured yet.</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Tithe", value: currency.format(transactions.filter((item) => contributionLabel(item) === "Tithe").reduce((sum, item) => sum + item.amount, 0)), icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Total Offerings", value: currency.format(transactions.filter((item) => ["Offering", "Sabbath Offering"].includes(contributionLabel(item))).reduce((sum, item) => sum + item.amount, 0)), icon: BadgeEuro, tone: "bg-blue-50 text-churchblue" },
          { label: "Total Donations", value: currency.format(transactions.filter((item) => ["Thanksgiving", "Special Donation", "Special Donations"].includes(contributionLabel(item))).reduce((sum, item) => sum + item.amount, 0)), icon: WalletCards, tone: "bg-amber-50 text-amber-700" },
          { label: "Monthly Totals", value: currency.format(monthlyTransactions.reduce((sum, item) => sum + item.amount, 0)), icon: Landmark, tone: "bg-purple-50 text-purple-700" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card className="flex items-center gap-4 p-5" key={label}>
            <div className={`rounded-lg p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
            <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div>
          </Card>
        ))}
      </section>

      {activeTab === "dashboard" && (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader><div><h2 className="font-bold text-navy">Monthly Finance Summary</h2><p className="mt-1 text-xs text-slate-400">Income versus expenditure by month</p></div><BarChart3 className="h-5 w-5 text-churchblue" /></CardHeader>
            <CardContent className="space-y-4">
              {monthly.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No payments recorded yet.</p>}
              {monthly.map(([month, row]) => <div key={month}><div className="flex justify-between text-xs"><span className="font-semibold text-slate-600">{month}</span><span className="font-bold text-navy">{currency.format(row.income - row.expenditure)}</span></div><div className="mt-2 grid grid-cols-2 gap-2"><div className="h-2 rounded-full bg-emerald-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(row.income / Math.max(income, 1) * 100, 100)}%` }} /></div><div className="h-2 rounded-full bg-rose-100"><div className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.min(row.expenditure / Math.max(expenditure, 1) * 100, 100)}%` }} /></div></div></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><h2 className="font-bold text-navy">Core Accounts</h2><p className="mt-1 text-xs text-slate-400">Current church account balances</p></div><BookOpenCheck className="h-5 w-5 text-gold" /></CardHeader>
            <CardContent className="space-y-3">{accounts.slice(0, 6).map((account) => <AccountLine account={account} key={account.id} />)}</CardContent>
          </Card>
        </section>
      )}

      {activeTab === "dashboard" && (
        <Card>
          <CardHeader><div><h2 className="font-bold text-navy">Giving Dashboard Charts</h2><p className="mt-1 text-xs text-slate-400">Tithe, offering, building fund, and welfare fund totals for {selectedYear}</p></div><BarChart3 className="h-5 w-5 text-churchblue" /></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {chartTotals.map(({ category, value }) => <ChartCard key={category} label={category} value={value} max={Math.max(...chartTotals.map((item) => item.value), 1)} />)}
          </CardContent>
        </Card>
      )}

      {activeTab === "add" && (
        <Card className="p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-navy">Record Tithe & Offerings</h2>
              <p className="mt-1 text-sm text-slate-500">Record tithe, Sabbath offering, building fund, thanksgiving, and special donation against a member.</p>
            </div>
            <Button disabled={!canManageContributions} title={canManageContributions ? "Record a contribution" : "Access denied: Treasurer or Admin only"} onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Record Contribution</Button>
          </div>
          {!canManageContributions && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Access denied: only the Treasurer or Admin can create, edit, or delete contribution records.</p>}
        </Card>
      )}

      {(activeTab === "history" || activeTab === "statement" || activeTab === "monthly" || activeTab === "quarterly" || activeTab === "annual") && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-bold text-navy">{activeTab === "history" ? "Contribution History" : activeTab === "statement" ? "Member Contribution Statement" : activeTab === "monthly" ? "Monthly Report" : activeTab === "quarterly" ? "Quarterly Report" : "Annual Report"}</h2>
              <p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church tithe, offerings, donations, and giving report summaries.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab === "statement" && <select className={fieldClass} value={statementMemberId} onChange={(event) => setStatementMemberId(event.target.value)}><option value="">All members</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.memberNumber})</option>)}</select>}
              <select className={fieldClass} value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>{availableYears.map((year) => <option key={year}>{year}</option>)}</select>
              <select className={fieldClass} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>{financeCategories.map((category) => <option key={category}>{category}</option>)}</select>
              <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> {t("button.exportPdf")}</Button>
              <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> {t("button.exportExcel")}</Button>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <ReportCard label="Total tithe this month" value={currency.format(totalTitheThisMonth)} />
            <ReportCard label="Total offerings this month" value={currency.format(totalOfferingsThisMonth)} />
            <ReportCard label="Total donations this month" value={currency.format(totalDonationsThisMonth)} />
          </div>
          {(activeTab === "monthly" || activeTab === "quarterly" || activeTab === "annual") && <ReportBreakdowns incomeSubAccountTotals={incomeSubAccountTotals} expenditureSubAccountTotals={expenditureSubAccountTotals} memberTotals={memberTotals} monthTotals={monthTotals} paymentMethodTotals={paymentMethodTotals} />}
          <TransactionTable rows={reportRows} canManage={canManageContributions && activeTab === "history"} onEdit={handleEdit} onDelete={handleDelete} />
        </Card>
      )}

      {activeTab === "subaccounts" && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
            <div><h2 className="font-bold text-navy">Income and Expenditure Sub-Accounts</h2><p className="mt-1 text-xs text-slate-400">Create future giving and expense categories without changing code.</p></div>
            <Button disabled={!canManageSubAccounts} title={canManageSubAccounts ? "Add a finance sub-account" : "Access denied: Super Admin or Treasurer only"} onClick={() => openCategory()}><Plus className="h-4 w-4" /> Add Sub-Account</Button>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {(["Income", "Expenditure"] as FinanceSubAccountGroup[]).map((group) => <div className="rounded-xl border border-slate-100 p-4" key={group}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-navy">{group}</h3><StatusBadge tone={group === "Income" ? "green" : "red"}>{categories.filter((category) => category.group === group).length} sub-accounts</StatusBadge></div><div className="space-y-3">{categories.filter((category) => category.group === group).map((category) => <div className="rounded-lg border border-slate-100 p-3" key={category.id}><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-navy">{category.name}</p><StatusBadge tone={category.isActive ? "green" : "slate"}>{category.isActive ? "Active" : "Inactive"}</StatusBadge></div><p className="mt-1 text-xs text-slate-500">{category.description || "No description yet."}</p></div><div className="flex gap-1"><Button disabled={!canManageSubAccounts} title={canManageSubAccounts ? "Edit sub-account" : "Access denied"} variant="ghost" size="sm" onClick={() => openCategory(category)}><Pencil className="h-4 w-4" /> Edit</Button></div></div></div>)}{categories.filter((category) => category.group === group).length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No {group.toLowerCase()} sub-accounts yet.</p>}</div></div>)}
          </div>
        </Card>
      )}

      {(activeTab === "accounts" || activeTab === "cash" || activeTab === "bank") && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
            <div><h2 className="font-bold text-navy">{activeTab === "cash" ? "Cash Account Page" : activeTab === "bank" ? "Bank Account Page" : "Accounts"}</h2><p className="mt-1 text-xs text-slate-400">Only Treasurer can create, edit, or delete accounts.</p></div>
            <Button disabled={!isTreasurer} title={isTreasurer ? "Add a finance account" : "Access denied: Treasurer only"} onClick={() => openAccount()}><Plus className="h-4 w-4" /> Add New Account</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Account", "Type", "Opening Balance", "Current Balance", "Status", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
              <tbody>
                {loading && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={6}>Loading finance accounts...</td></tr>}
                {accountRows.map((account) => <tr className="border-b border-slate-100 last:border-0" key={account.id}><td className="px-5 py-4"><p className="font-bold text-navy">{ft(account.name)}</p><p className="mt-1 text-xs text-slate-400">{account.description}</p></td><td className="px-5 py-4"><StatusBadge tone="blue">{ft(account.accountType)}</StatusBadge></td><td className="px-5 py-4 text-slate-600">{currency.format(account.openingBalance)}</td><td className="px-5 py-4 font-bold text-navy">{currency.format(account.currentBalance)}</td><td className="px-5 py-4"><StatusBadge tone={account.status === "Active" ? "green" : "slate"}>{account.status}</StatusBadge></td><td className="px-5 py-4"><div className="flex gap-1"><Button disabled={!isTreasurer} title={isTreasurer ? "Edit account" : "Access denied: Treasurer only"} variant="ghost" size="sm" onClick={() => openAccount(account)}><Pencil className="h-4 w-4" /> {t("button.edit")}</Button><Button disabled={!isTreasurer} title={isTreasurer ? "Delete account" : "Access denied: Treasurer only"} variant="ghost" size="sm" onClick={() => deleteAccount(account)}><Trash2 className="h-4 w-4 text-rose-600" /> {t("button.delete")}</Button></div></td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(activeTab === "transactions" || activeTab === "cash" || activeTab === "bank" || activeTab === "income") && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <label className="flex h-10 max-w-md flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input className="w-full bg-transparent text-sm outline-none" placeholder="Search payments..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <Button disabled={!canManageContributions} title={canManageContributions ? "Add a contribution" : "Access denied: Treasurer or Admin only"} onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Add Contribution</Button>
          </div>
          <TransactionTable rows={transactionRows} canManage={canManageContributions} onEdit={handleEdit} onDelete={handleDelete} />
        </Card>
      )}

      {activeTab === "reports" && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <select className={fieldClass} value={report} onChange={(event) => setReport(event.target.value as FinanceReport)}>{FINANCE_REPORTS.map((item) => <option key={item}>{item}</option>)}</select>
            <div className="flex gap-2"><Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> {t("button.exportPdf")}</Button><Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> {t("button.exportExcel")}</Button></div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <ReportCard label={t("finance.income")} value={currency.format(income)} />
            <ReportCard label={t("finance.expenditure")} value={currency.format(expenditure)} />
            <ReportCard label="Net Balance" value={currency.format(income - expenditure)} />
          </div>
          <TransactionTable rows={filteredTransactions} canManage={false} onEdit={handleEdit} onDelete={handleDelete} />
        </Card>
      )}

      {activeTab === "whatsapp" && (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><div><h2 className="font-bold text-navy">WhatsApp Payment Settings</h2><p className="mt-1 text-xs text-slate-400">Token is submitted to the server only and is never rendered back to the browser.</p></div><MessageCircle className="h-5 w-5 text-churchblue" /></CardHeader>
            <CardContent>
              {!whatsappConfigured && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">WhatsApp integration not configured yet.</p>}
              <form className="space-y-4" onSubmit={saveWhatsAppSettings}>
                <label className="text-sm font-semibold text-slate-700">WhatsApp Business Phone Number ID<input className={fieldClass} value={settingsForm.phoneNumberId} onChange={(event) => setSettingsForm({ ...settingsForm, phoneNumberId: event.target.value })} /></label>
                <label className="text-sm font-semibold text-slate-700">WhatsApp Business Access Token<input className={fieldClass} placeholder={settingsForm.accessTokenConfigured ? "Token configured. Enter a new token to replace it." : "Paste server-side token"} type="password" value={settingsForm.accessToken} onChange={(event) => setSettingsForm({ ...settingsForm, accessToken: event.target.value })} /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Default Template Name<input className={fieldClass} value={settingsForm.defaultTemplateName} onChange={(event) => setSettingsForm({ ...settingsForm, defaultTemplateName: event.target.value })} /></label>
                  <label className="text-sm font-semibold text-slate-700">Template Language<input className={fieldClass} value={settingsForm.templateLanguage} onChange={(event) => setSettingsForm({ ...settingsForm, templateLanguage: event.target.value })} /></label>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input className="accent-churchblue" type="checkbox" checked={settingsForm.autoNotificationsEnabled} onChange={(event) => setSettingsForm({ ...settingsForm, autoNotificationsEnabled: event.target.checked })} /> Enable automatic WhatsApp receipts when Treasurer records member payments</label>
                <Button type="submit">Save WhatsApp Settings</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><div><h2 className="font-bold text-navy">Payment Notification Logs</h2><p className="mt-1 text-xs text-slate-400">Visible to Super Admin and Treasurer. Retry is available to authorized finance managers.</p></div><StatusBadge tone="blue">{notificationLogs.length} logs</StatusBadge></CardHeader>
            <CardContent className="space-y-3">
              {notificationLogs.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No WhatsApp payment notifications have been logged.</p>}
              {notificationLogs.map((log) => <div className="rounded-lg border border-slate-100 p-3" key={log.id}><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-navy">{log.phoneNumber}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{log.message}</p>{log.errorMessage && <p className="mt-1 text-xs text-rose-600">{log.errorMessage}</p>}</div><div className="flex items-center gap-2"><StatusBadge tone={log.status === "Sent" ? "green" : log.status === "Failed" ? "red" : "gold"}>{log.status}</StatusBadge><Button disabled={!isTreasurer || log.status === "Sent"} size="sm" variant="outline" title={isTreasurer ? "Retry notification" : "Access denied: Treasurer only"} onClick={() => retryNotification(log.paymentId)}><RotateCw className="h-4 w-4" /> Retry</Button></div></div></div>)}
            </CardContent>
          </Card>
        </section>
      )}

      {accountForm && <AccountModal form={accountForm} setForm={setAccountForm} editing={editingAccount} saving={saving} onClose={() => setAccountForm(null)} onSubmit={saveAccount} />}
      {categoryForm && <CategoryModal form={categoryForm} setForm={setCategoryForm} editing={editingCategory} saving={saving} onClose={() => setCategoryForm(null)} onSubmit={saveCategory} />}
      {transactionForm && <TransactionModal accounts={accounts} categories={categories} members={members} paymentMethods={paymentMethods} form={transactionForm} setForm={setTransactionForm} editing={editingTransaction} saving={saving} onClose={() => setTransactionForm(null)} onSubmit={saveTransaction} />}
    </div>
  );
}

function AccountLine({ account }: { account: Account }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  return <div className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-bold text-navy">{ft(account.name)}</p><p className="mt-1 text-xs text-slate-400">{ft(account.accountType)}</p></div><p className="font-bold text-churchblue">{currency.format(account.currentBalance)}</p></div>;
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-navy">{value}</p></div>;
}

function ChartCard({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.max(6, Math.min((value / Math.max(max, 1)) * 100, 100));
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-navy">{label}</p><p className="text-sm font-bold text-churchblue">{currency.format(value)}</p></div><div className="mt-4 h-3 rounded-full bg-white"><div className="h-3 rounded-full bg-gradient-to-r from-churchblue to-gold" style={{ width: `${percent}%` }} /></div></div>;
}

function groupTotals(rows: Transaction[], getLabel: (transaction: Transaction) => string) {
  return [...rows.reduce<Map<string, number>>((acc, item) => {
    const label = getLabel(item);
    acc.set(label, (acc.get(label) ?? 0) + item.amount);
    return acc;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
}

function ReportBreakdowns({ incomeSubAccountTotals, expenditureSubAccountTotals, memberTotals, monthTotals, paymentMethodTotals }: { incomeSubAccountTotals: [string, number][]; expenditureSubAccountTotals: [string, number][]; memberTotals: [string, number][]; monthTotals: [string, number][]; paymentMethodTotals: [string, number][] }) {
  return <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2"><Breakdown title="Income by sub-account" rows={incomeSubAccountTotals} /><Breakdown title="Expenditure by sub-account" rows={expenditureSubAccountTotals} /><Breakdown title="Giving by member" rows={memberTotals} /><Breakdown title="Totals by month" rows={monthTotals} /><Breakdown title="Totals by payment method" rows={paymentMethodTotals} /></div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <div className="rounded-xl border border-slate-100 p-4"><h3 className="font-bold text-navy">{title}</h3><div className="mt-3 space-y-2">{rows.length ? rows.map(([label, value]) => <div className="flex justify-between gap-3 text-sm" key={label}><span className="text-slate-600">{label}</span><span className="font-bold text-churchblue">{currency.format(value)}</span></div>) : <p className="text-sm text-slate-500">No records found.</p>}</div></div>;
}

function TransactionTable({ rows, canManage, onEdit, onDelete }: { rows: Transaction[]; canManage: boolean; onEdit: (transaction: Transaction) => void; onDelete: (transactionId: string) => void }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  const handleEdit = (transaction: Transaction) => onEdit(transaction);
  const handleDelete = (transactionId: string) => onDelete(transactionId);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Member Name", "Sub-Account", "Method", "Account", "Entered By", "Reference", "Amount", "WhatsApp", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-5 py-4 font-semibold text-navy">{item.date}</td><td className="px-5 py-4 text-slate-600">{item.memberName || "-"}</td><td className="px-5 py-4"><StatusBadge tone={signedAmount(item) < 0 ? "slate" : "gold"}>{ft(item.categoryName || item.type)}</StatusBadge>{item.notes && <p className="mt-1 max-w-48 truncate text-xs text-slate-400">{item.notes}</p>}</td><td className="px-5 py-4 text-slate-600">{item.paymentMethod || "Cash"}</td><td className="px-5 py-4 text-slate-600">{ft(item.accountName)}</td><td className="px-5 py-4 text-slate-600">{item.enteredBy}</td><td className="px-5 py-4 text-slate-500">{item.reference || "-"}</td><td className="px-5 py-4 font-bold text-navy">{currency.format(item.amount)}</td><td className="px-5 py-4"><StatusBadge tone={item.whatsappStatus === "Sent" ? "green" : item.whatsappStatus === "Failed" ? "red" : item.whatsappStatus === "Pending" ? "gold" : "slate"}>{item.whatsappStatus}</StatusBadge>{item.whatsappError && <p className="mt-1 max-w-44 truncate text-xs text-rose-600">{item.whatsappError}</p>}</td><td className="px-5 py-4"><div className="flex gap-1"><Link href={`/contributions/receipt/${item.id}`}><Button type="button" variant="ghost" size="sm">{t("button.receipt")}</Button></Link><Button type="button" disabled={!canManage} title={canManage ? "Edit contribution" : "Access denied: Treasurer or Admin only"} variant="ghost" size="sm" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /> {t("button.edit")}</Button><Button type="button" disabled={!canManage} title={canManage ? "Delete contribution" : "Access denied: Treasurer or Admin only"} variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-rose-600" /> {t("button.delete")}</Button></div></td></tr>)}
          {rows.length === 0 && <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={10}>No payments found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AccountModal({ form, setForm, editing, saving, onClose, onSubmit }: { form: AccountForm; setForm: (form: AccountForm) => void; editing: Account | null; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold text-navy">{editing ? "Edit Account" : "Add New Account"}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close account form"><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Account Name<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Account Type<select className={fieldClass} value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value as FinanceAccountType })}>{FINANCE_ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{ft(type)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Opening Balance<input className={fieldClass} min="0" step="0.01" type="number" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: Number(event.target.value) })} /></label><label className="text-sm font-semibold text-slate-700">Status<select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AccountStatus })}><option>Active</option><option>Inactive</option></select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>{t("button.cancel")}</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : t("button.saveAccount")}</Button></div></form></div>;
}

function CategoryModal({ form, setForm, editing, saving, onClose, onSubmit }: { form: CategoryForm; setForm: (form: CategoryForm) => void; editing: Category | null; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const t = useT();
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="w-full max-w-2xl rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-bold text-navy">{editing ? "Edit Sub-Account" : "Add Sub-Account"}</h2><p className="mt-1 text-xs text-slate-400">Dynamic income and expenditure categories for Hamburg Ghana SDA Church.</p></div><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close sub-account form"><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Sub-Account Name<input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Main Group<select className={fieldClass} value={form.group} onChange={(event) => setForm({ ...form, group: event.target.value as FinanceSubAccountGroup })}><option>Income</option><option>Expenditure</option></select></label><label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-700"><input className="accent-churchblue" type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active sub-account</label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="flex justify-end gap-2 border-t border-slate-100 p-4"><Button type="button" variant="outline" onClick={onClose}>{t("button.cancel")}</Button><Button disabled={saving} type="submit">{saving ? "Saving..." : "Save Sub-Account"}</Button></div></form></div>;
}

function TransactionModal({ accounts, categories, members, paymentMethods, form, setForm, editing, saving, onClose, onSubmit }: { accounts: Account[]; categories: Category[]; members: MemberOption[]; paymentMethods: PaymentMethod[]; form: TransactionForm; setForm: (form: TransactionForm) => void; editing: Transaction | null; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const isTransfer = false;
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  const availableCategories = categories.filter((category) => category.group === form.type && (category.isActive || category.id === form.categoryId));
  const availablePaymentMethods = paymentMethods.includes(form.paymentMethod) ? paymentMethods : [...paymentMethods, form.paymentMethod].filter(Boolean);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-5"><h2 className="font-bold text-navy">{editing ? "Edit Contribution" : "Add Contribution"}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close payment form"><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Main Group<select className={fieldClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinanceSubAccountGroup, categoryId: "", memberId: event.target.value === "Expenditure" ? "" : form.memberId })}><option>Income</option><option>Expenditure</option></select></label><label className="text-sm font-semibold text-slate-700">Contribution Type<select className={fieldClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Select contribution type</option>{availableCategories.map((category) => <option disabled={!category.isActive && category.id !== form.categoryId} value={category.id} key={category.id}>{category.name}{category.isActive ? "" : " (Inactive)"}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Member name<select className={fieldClass} value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}><option value="">{form.type === "Income" ? "Optional. Select member for contribution income" : "Optional for expenditure"}</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} ({member.memberNumber})</option>)}</select>{members.length === 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">No active members are available. Confirm members have Active status and Treasurer/Admin can read member records.</p>}</label><label className="text-sm font-semibold text-slate-700">Amount (€)<input className={fieldClass} min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label><label className="text-sm font-semibold text-slate-700">Payment Date<input className={fieldClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Currency<input className={fieldClass} value="EUR" readOnly /></label><label className="text-sm font-semibold text-slate-700">Payment Method<select className={fieldClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>{availablePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Receipt number<input className={fieldClass} placeholder="Auto-generated if left blank" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Finance Account<select className={fieldClass} value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required>{accounts.map((account) => <option value={account.id} key={account.id}>{ft(account.name)}</option>)}</select></label>{isTransfer && <label className="text-sm font-semibold text-slate-700">Transfer To<select className={fieldClass} value={form.transferToAccountId} onChange={(event) => setForm({ ...form, transferToAccountId: event.target.value })} required><option value="">Select destination</option>{accounts.filter((account) => account.id !== form.accountId).map((account) => <option value={account.id} key={account.id}>{ft(account.name)}</option>)}</select></label>}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>{t("button.cancel")}</Button><Button disabled={saving} type="submit"><ArrowRightLeft className="h-4 w-4" /> {saving ? "Saving..." : "Save Contribution"}</Button></div></form></div>;
}
