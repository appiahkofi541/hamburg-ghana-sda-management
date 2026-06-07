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
import {
  FINANCE_ACCOUNT_TYPES,
  FINANCE_REPORTS,
  FINANCE_TRANSACTION_TYPES,
  type FinanceAccountType,
  type FinanceReport,
  type FinanceTransactionType,
} from "@/lib/types";
import { positiveNumber, required } from "@/lib/validation";
import type { TranslationKey } from "@/lib/i18n";

type FinanceTab = "dashboard" | "add" | "history" | "statement" | "monthly" | "annual" | "accounts" | "transactions" | "reports" | "cash" | "bank" | "income" | "whatsapp";
type AccountStatus = "Active" | "Inactive";
type StoredTransactionType = FinanceTransactionType | "Income" | "Expenditure" | "Transfer" | "Expense" | "Other Church Payment";
type PaymentMethod = "Cash" | "Bank Transfer" | "Card" | "Mobile Money" | "Other";
type Account = {
  id: string;
  name: string;
  accountType: FinanceAccountType;
  openingBalance: number;
  currentBalance: number;
  description: string;
  status: AccountStatus;
};
type Category = { id: string; name: string; type: FinanceTransactionType };
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
type TransactionForm = {
  date: string;
  type: FinanceTransactionType;
  accountId: string;
  memberId: string;
  transferToAccountId: string;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes: string;
  reference: string;
};
type MemberOption = { id: string; memberNumber: string; name: string; whatsappPhone: string; phone: string };
type PaymentNotificationLog = { id: string; memberId: string; paymentId: string; phoneNumber: string; message: string; status: string; errorMessage: string; sentAt: string; createdAt: string };
type WhatsAppSettings = { phoneNumberId: string; accessToken: string; defaultTemplateName: string; templateLanguage: string; autoNotificationsEnabled: boolean; accessTokenConfigured: boolean };

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const tabs: { id: FinanceTab; label: string }[] = [
  { id: "dashboard", label: "Finance Dashboard" },
  { id: "add", label: "Add Contribution" },
  { id: "history", label: "Contribution History" },
  { id: "statement", label: "Member Statement" },
  { id: "monthly", label: "Monthly Report" },
  { id: "annual", label: "Annual Report" },
  { id: "accounts", label: "Accounts" },
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
const emptyTransaction: TransactionForm = {
  date: new Date().toISOString().slice(0, 10),
  type: "Tithe",
  accountId: "",
  memberId: "",
  transferToAccountId: "",
  categoryId: "",
  amount: 0,
  paymentMethod: "Cash",
  notes: "",
  reference: "",
};
const paymentMethods: PaymentMethod[] = ["Cash", "Bank Transfer", "Card", "Mobile Money", "Other"];

const fieldClass = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-churchblue";

function labelize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function enumize(value: string) {
  if (value === "Other") return "other";
  return value.toLowerCase().replaceAll(" ", "_");
}

function contributionTypeEnum(value: FinanceTransactionType) {
  const map: Record<FinanceTransactionType, string> = {
    Tithe: "tithe",
    Offering: "offering",
    Thanksgiving: "donation",
    "Building Fund": "building_fund",
    "Welfare Fund": "welfare",
    "Special Donations": "donation",
    Other: "other",
  };
  return map[value];
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

export function FinanceManagement({ initialTab = "dashboard" }: { initialTab?: FinanceTab }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<PaymentNotificationLog[]>([]);
  const [settingsForm, setSettingsForm] = useState<WhatsAppSettings>({ phoneNumberId: "", accessToken: "", defaultTemplateName: "payment_receipt", templateLanguage: "en", autoNotificationsEnabled: false, accessTokenConfigured: false });
  const [whatsappConfigured, setWhatsappConfigured] = useState(true);
  const [query, setQuery] = useState("");
  const [statementMemberId, setStatementMemberId] = useState("");
  const [report, setReport] = useState<FinanceReport>("Income and Expenditure");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTreasurer, setIsTreasurer] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionForm | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    async function loadFinance() {
      const supabase = createClient();
      if (!supabase) {
        setAccounts(defaultAccounts);
        setLoading(false);
        setIsTreasurer(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        setIsTreasurer((roleRows ?? []).some(({ role }) => role === "treasurer"));
      }

      const [accountResult, categoryResult, memberResult, logResult, transactionResult] = await Promise.all([
        supabase.from("finance_accounts").select("*").order("name"),
        supabase.from("finance_categories").select("*").order("name"),
        supabase.from("members").select("id, member_number, full_name, whatsapp_phone, phone").eq("status", "active").order("full_name"),
        supabase.from("whatsapp_payment_notification_logs").select("*").order("created_at", { ascending: false }),
        supabase
          .from("finance_transactions")
          .select("*, account:finance_accounts!finance_transactions_account_id_fkey(name), transfer_account:finance_accounts!finance_transactions_transfer_to_account_id_fkey(name), finance_categories(name), members(full_name), recorded_by_profile:profiles!finance_transactions_recorded_by_fkey(full_name)")
          .order("transaction_date", { ascending: false }),
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
      setCategories((categoryResult.data ?? []).map((row) => ({ id: row.id, name: row.name, type: labelize(row.type) as FinanceTransactionType })));
      if (memberResult.error) setError(`Unable to load active members for finance payments: ${memberResult.error.message}`);
      setMembers((memberResult.data ?? []).map((row) => ({ id: row.id, memberNumber: row.member_number ?? "", name: row.full_name, whatsappPhone: row.whatsapp_phone ?? "", phone: row.phone ?? "" })));
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
  const assets = accounts.filter(({ accountType }) => accountType === "Asset").reduce((sum, item) => sum + item.currentBalance, 0);
  const funds = accounts.filter(({ accountType }) => accountType === "Fund").reduce((sum, item) => sum + item.currentBalance, 0);
  const accessMessage = isTreasurer
    ? "Finance management access: you can add, modify, delete, search, export, and generate receipts for all payments."
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
  const monthlyTransactions = filteredTransactions.filter((item) => item.date.startsWith(currentMonth));
  const annualTransactions = filteredTransactions.filter((item) => item.date.startsWith(currentYear));
  const statementRows = filteredTransactions.filter((item) => !statementMemberId || item.memberId === statementMemberId);
  const totalTitheThisMonth = monthlyTransactions.filter((item) => (item.categoryName || item.type) === "Tithe").reduce((sum, item) => sum + item.amount, 0);
  const totalOfferingsThisMonth = monthlyTransactions.filter((item) => (item.categoryName || item.type) === "Offering").reduce((sum, item) => sum + item.amount, 0);
  const totalDonationsThisMonth = monthlyTransactions.filter((item) => ["Thanksgiving", "Special Donations", "Other", "Donation"].includes(item.categoryName || item.type)).reduce((sum, item) => sum + item.amount, 0);
  const categoryTotals = useMemo(() => groupTotals(filteredTransactions, (item) => item.categoryName || item.type), [filteredTransactions]);
  const memberTotals = useMemo(() => groupTotals(filteredTransactions, (item) => item.memberName || "Unassigned"), [filteredTransactions]);

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
    if (!isTreasurer) return;
    const storedType = transaction?.categoryName && FINANCE_TRANSACTION_TYPES.includes(transaction.categoryName as FinanceTransactionType)
      ? transaction.categoryName as FinanceTransactionType
      : transaction?.type && FINANCE_TRANSACTION_TYPES.includes(transaction.type as FinanceTransactionType)
        ? transaction.type as FinanceTransactionType
        : "Other";
    setEditingTransaction(transaction ?? null);
    setTransactionForm(transaction ? {
      date: transaction.date,
      type: storedType,
      accountId: transaction.accountId,
      memberId: transaction.memberId,
      transferToAccountId: transaction.transferToAccountId,
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      notes: transaction.notes,
      reference: transaction.reference,
    } : { ...emptyTransaction, accountId: accounts[0]?.id ?? "" });
  }

  async function reloadAfterWrite() {
    const supabase = createClient();
    if (!supabase) return;
    const [{ data: accountRows }, { data: logRows }, { data: transactionRows }] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("name"),
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

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transactionForm || !isTreasurer) return;
    const validationError = required(transactionForm.memberId, "Member name") || required(transactionForm.accountId, "Account") || required(transactionForm.paymentMethod, "Payment method") || positiveNumber(Number(transactionForm.amount), "Amount");
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    const supabase = createClient();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const generatedReference = transactionForm.reference || receiptNumber();
      const description = transactionForm.notes || `${transactionForm.type} payment`;
      const selectedCategory = categories.find((category) => category.name === transactionForm.type);
      const payload = {
        transaction_date: transactionForm.date,
        transaction_type: contributionTypeEnum(transactionForm.type),
        account_id: transactionForm.accountId,
        member_id: transactionForm.memberId,
        transfer_to_account_id: null,
        category_id: transactionForm.categoryId || selectedCategory?.id || null,
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
        setError(`${saveError.message}. If this mentions payment_method or notes, apply migration 202606030006_finance_payment_member_workflow.sql in Supabase.`);
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

  async function deleteTransaction(transaction: Transaction) {
    if (!isTreasurer) return;
    if (!window.confirm(`Delete payment ${transaction.reference || transaction.description}?`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("finance_transactions").delete().eq("id", transaction.id);
      if (deleteError) { setError(deleteError.message); return; }
      await reloadAfterWrite();
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
    document.text(`Hamburg Ghana SDA Church - ${report} Report`, 14, 16);
    autoTableModule.default(document, {
      startY: 24,
      head: [["Date", "Member", "Contribution Type", "Account", "Entered By", "Reference", "Amount"]],
      body: filteredTransactions.map((item) => [item.date, item.memberName, item.categoryName || item.type, item.accountName, item.enteredBy, item.reference, currency.format(item.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 41, 76] },
    });
    document.save(`Hamburg-Ghana-SDA-${report.replaceAll(" ", "-")}.pdf`);
  }

  function exportExcel() {
    const headers = ["Date", "Member", "Type", "Account", "Category", "Currency", "Entered By", "Reference", "Amount"];
    const escapeXml = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]!);
    const row = (values: string[]) => `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const rows = filteredTransactions.map((item) => row([item.date, item.memberName, item.categoryName || item.type, item.accountName, item.categoryName, item.currency, item.enteredBy, item.reference, String(item.amount)]));
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Finance"><Table>${row(headers)}${rows.join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Hamburg-Ghana-SDA-${report.replaceAll(" ", "-")}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const accountRows = activeTab === "cash" ? accounts.filter(({ name }) => name.toLowerCase().includes("cash")) : activeTab === "bank" ? accounts.filter(({ name }) => name.toLowerCase().includes("bank")) : accounts;
  const transactionRows = activeTab === "cash" ? filteredTransactions.filter(({ accountName, transferToAccountName }) => `${accountName} ${transferToAccountName}`.toLowerCase().includes("cash")) : activeTab === "bank" ? filteredTransactions.filter(({ accountName, transferToAccountName }) => `${accountName} ${transferToAccountName}`.toLowerCase().includes("bank")) : filteredTransactions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <PageHeading title="Church Accounting" description="Manage accounts, cash, bank, tithe, offerings, donations, welfare, expenses, and finance reports." />
        <StatusBadge tone={isTreasurer ? "green" : "slate"}>{isTreasurer ? "Finance full access" : "Read-only access"}</StatusBadge>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-100 bg-white p-2 shadow-card">
        {tabs.map((tab) => <Button key={tab.id} size="sm" variant={activeTab === tab.id ? "default" : "ghost"} onClick={() => setActiveTab(tab.id)}>{ft(tab.label)}</Button>)}
      </div>

      {notice && <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-churchblue"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <div className={`rounded-lg px-4 py-3 text-sm font-medium ${isTreasurer ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{accessMessage}</div>
      {!whatsappConfigured && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">WhatsApp integration not configured yet.</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Income", value: currency.format(income), icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Total Expenditure", value: currency.format(expenditure), icon: BadgeEuro, tone: "bg-rose-50 text-rose-700" },
          { label: "Cash & Bank Assets", value: currency.format(assets), icon: Landmark, tone: "bg-blue-50 text-churchblue" },
          { label: "Fund Balances", value: currency.format(funds), icon: WalletCards, tone: "bg-amber-50 text-amber-700" },
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

      {activeTab === "add" && (
        <Card className="p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-navy">Add Contribution</h2>
              <p className="mt-1 text-sm text-slate-500">Record tithe, offerings, thanksgiving, building fund, welfare fund, special donations, and other church contributions.</p>
            </div>
            <Button disabled={!isTreasurer} title={isTreasurer ? "Add a contribution" : "Access denied: Treasurer only"} onClick={() => openTransaction()}><Plus className="h-4 w-4" /> Add Contribution</Button>
          </div>
          {!isTreasurer && <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Access denied: only the Treasurer can create, edit, or delete contribution records.</p>}
        </Card>
      )}

      {(activeTab === "history" || activeTab === "statement" || activeTab === "monthly" || activeTab === "annual") && (
        <Card>
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-bold text-navy">{activeTab === "history" ? "Contribution History" : activeTab === "statement" ? "Member Contribution Statement" : activeTab === "monthly" ? "Monthly Report" : "Annual Report"}</h2>
              <p className="mt-1 text-xs text-slate-400">Hamburg Ghana SDA Church giving records and report summaries.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTab === "statement" && <select className={fieldClass} value={statementMemberId} onChange={(event) => setStatementMemberId(event.target.value)}><option value="">All members</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}
              <Button variant="outline" onClick={exportPdf}><Download className="h-4 w-4" /> {t("button.exportPdf")}</Button>
              <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> {t("button.exportExcel")}</Button>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <ReportCard label="Total tithe this month" value={currency.format(totalTitheThisMonth)} />
            <ReportCard label="Total offerings this month" value={currency.format(totalOfferingsThisMonth)} />
            <ReportCard label="Total donations this month" value={currency.format(totalDonationsThisMonth)} />
          </div>
          {(activeTab === "monthly" || activeTab === "annual") && <ReportBreakdowns categoryTotals={categoryTotals} memberTotals={memberTotals} />}
          <TransactionTable rows={activeTab === "monthly" ? monthlyTransactions : activeTab === "annual" ? annualTransactions : activeTab === "statement" ? statementRows : filteredTransactions} isTreasurer={isTreasurer && activeTab === "history"} onEdit={openTransaction} onDelete={deleteTransaction} />
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
            <Button disabled={!isTreasurer} title={isTreasurer ? "Add a payment" : "Access denied: Treasurer only"} onClick={() => openTransaction()}><Plus className="h-4 w-4" /> {t("button.addPayment")}</Button>
          </div>
          <TransactionTable rows={transactionRows} isTreasurer={isTreasurer} onEdit={openTransaction} onDelete={deleteTransaction} />
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
          <TransactionTable rows={filteredTransactions} isTreasurer={false} onEdit={openTransaction} onDelete={deleteTransaction} />
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
      {transactionForm && <TransactionModal accounts={accounts} categories={categories} members={members} form={transactionForm} setForm={setTransactionForm} editing={editingTransaction} saving={saving} onClose={() => setTransactionForm(null)} onSubmit={saveTransaction} />}
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

function groupTotals(rows: Transaction[], getLabel: (transaction: Transaction) => string) {
  return [...rows.reduce<Map<string, number>>((acc, item) => {
    const label = getLabel(item);
    acc.set(label, (acc.get(label) ?? 0) + item.amount);
    return acc;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
}

function ReportBreakdowns({ categoryTotals, memberTotals }: { categoryTotals: [string, number][]; memberTotals: [string, number][] }) {
  return <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2"><Breakdown title="Giving by category" rows={categoryTotals} /><Breakdown title="Giving by member" rows={memberTotals} /></div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <div className="rounded-xl border border-slate-100 p-4"><h3 className="font-bold text-navy">{title}</h3><div className="mt-3 space-y-2">{rows.length ? rows.map(([label, value]) => <div className="flex justify-between gap-3 text-sm" key={label}><span className="text-slate-600">{label}</span><span className="font-bold text-churchblue">{currency.format(value)}</span></div>) : <p className="text-sm text-slate-500">No records found.</p>}</div></div>;
}

function TransactionTable({ rows, isTreasurer, onEdit, onDelete }: { rows: Transaction[]; isTreasurer: boolean; onEdit: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void }) {
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">{["Date", "Member Name", "Contribution Type", "Method", "Account", "Entered By", "Reference", "Amount", "WhatsApp", "Actions"].map((label) => <th className="px-5 py-3.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-5 py-4 font-semibold text-navy">{item.date}</td><td className="px-5 py-4 text-slate-600">{item.memberName || "-"}</td><td className="px-5 py-4"><StatusBadge tone={signedAmount(item) < 0 ? "slate" : "gold"}>{ft(item.categoryName || item.type)}</StatusBadge>{item.notes && <p className="mt-1 max-w-48 truncate text-xs text-slate-400">{item.notes}</p>}</td><td className="px-5 py-4 text-slate-600">{item.paymentMethod || "Cash"}</td><td className="px-5 py-4 text-slate-600">{ft(item.accountName)}</td><td className="px-5 py-4 text-slate-600">{item.enteredBy}</td><td className="px-5 py-4 text-slate-500">{item.reference || "-"}</td><td className="px-5 py-4 font-bold text-navy">{currency.format(item.amount)}</td><td className="px-5 py-4"><StatusBadge tone={item.whatsappStatus === "Sent" ? "green" : item.whatsappStatus === "Failed" ? "red" : item.whatsappStatus === "Pending" ? "gold" : "slate"}>{item.whatsappStatus}</StatusBadge>{item.whatsappError && <p className="mt-1 max-w-44 truncate text-xs text-rose-600">{item.whatsappError}</p>}</td><td className="px-5 py-4"><div className="flex gap-1"><Link href={`/offerings/receipt/${item.id}`}><Button variant="ghost" size="sm">{t("button.receipt")}</Button></Link><Button disabled={!isTreasurer} title={isTreasurer ? "Edit payment" : "Access denied: Treasurer only"} variant="ghost" size="sm" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /> {t("button.edit")}</Button><Button disabled={!isTreasurer} title={isTreasurer ? "Delete payment" : "Access denied: Treasurer only"} variant="ghost" size="sm" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 text-rose-600" /> {t("button.delete")}</Button></div></td></tr>)}
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

function TransactionModal({ accounts, categories, members, form, setForm, editing, saving, onClose, onSubmit }: { accounts: Account[]; categories: Category[]; members: MemberOption[]; form: TransactionForm; setForm: (form: TransactionForm) => void; editing: Transaction | null; saving: boolean; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const isTransfer = false;
  const t = useT();
  const ft = (label: string) => financeTranslationKeys[label] ? t(financeTranslationKeys[label]) : label;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><form className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl" onSubmit={onSubmit}><div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-5"><h2 className="font-bold text-navy">{editing ? "Edit Contribution" : "Add Contribution"}</h2><Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close payment form"><X className="h-5 w-5" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Member name<select className={fieldClass} value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })} required><option value="">Select member</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name} - {member.memberNumber || member.id.slice(0, 8).toUpperCase()}{member.whatsappPhone || member.phone ? "" : " - no WhatsApp number"}</option>)}</select>{members.length === 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">No active members are available. Confirm members have Active status and Treasurer can read member records.</p>}</label><label className="text-sm font-semibold text-slate-700">Contribution Type<select className={fieldClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinanceTransactionType, categoryId: categories.find((category) => category.name === event.target.value)?.id ?? "", transferToAccountId: "" })}>{FINANCE_TRANSACTION_TYPES.map((type) => <option key={type} value={type}>{ft(type)}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Amount (€)<input className={fieldClass} min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required /></label><label className="text-sm font-semibold text-slate-700">Payment Date<input className={fieldClass} type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label><label className="text-sm font-semibold text-slate-700">Currency<input className={fieldClass} value="EUR" readOnly /></label><label className="text-sm font-semibold text-slate-700">Payment Method<select className={fieldClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Reference number<input className={fieldClass} placeholder="Auto-generated if left blank" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">Finance Account<select className={fieldClass} value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required>{accounts.map((account) => <option value={account.id} key={account.id}>{ft(account.name)}</option>)}</select></label>{isTransfer && <label className="text-sm font-semibold text-slate-700">Transfer To<select className={fieldClass} value={form.transferToAccountId} onChange={(event) => setForm({ ...form, transferToAccountId: event.target.value })} required><option value="">Select destination</option>{accounts.filter((account) => account.id !== form.accountId).map((account) => <option value={account.id} key={account.id}>{ft(account.name)}</option>)}</select></label>}<label className="text-sm font-semibold text-slate-700">Category<select className={fieldClass} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Auto-match contribution type</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes<textarea className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-churchblue" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white p-4"><Button type="button" variant="outline" onClick={onClose}>{t("button.cancel")}</Button><Button disabled={saving} type="submit"><ArrowRightLeft className="h-4 w-4" /> {saving ? "Saving..." : "Save Contribution"}</Button></div></form></div>;
}
