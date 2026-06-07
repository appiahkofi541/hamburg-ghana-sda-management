export const SDA_DEPARTMENTS = [
  "Elders", "Deacons", "Deaconesses", "Treasury", "Secretariat",
  "Sabbath School", "Youth Ministry", "Women's Ministry", "Men's Ministry",
  "Pathfinder Club", "Adventurer Club", "Choir", "Media Ministry",
  "Children's Ministry", "Personal Ministries",
] as const;

export const ATTENDANCE_SERVICES = [
  "Sabbath School", "Divine Service", "Midweek Prayer Meeting",
  "Youth Program", "Special Event",
] as const;

export const FINANCE_FUNDS = [
  "Tithe", "Sabbath Offering", "Building Fund", "Mission Offering",
  "Thanksgiving Offering", "Special Donation",
] as const;

export const FINANCE_ACCOUNT_TYPES = ["Income", "Expense", "Asset", "Liability", "Fund"] as const;
export const FINANCE_TRANSACTION_TYPES = ["Tithe", "Offering", "Thanksgiving", "Building Fund", "Welfare Fund", "Special Donations", "Other"] as const;
export const FINANCE_REPORTS = [
  "Income and Expenditure",
  "Cash Book",
  "Bank Statement",
  "Monthly Finance Summary",
  "Quarterly Finance Summary",
  "Yearly Finance Summary",
  "Account Balance",
] as const;

export type SdaDepartment = (typeof SDA_DEPARTMENTS)[number];
export type AttendanceService = (typeof ATTENDANCE_SERVICES)[number];
export type FinanceFund = (typeof FINANCE_FUNDS)[number];
export type FinanceAccountType = (typeof FINANCE_ACCOUNT_TYPES)[number];
export type FinanceTransactionType = (typeof FINANCE_TRANSACTION_TYPES)[number];
export type FinanceReport = (typeof FINANCE_REPORTS)[number];

export type DepartmentRecord = {
  id: string;
  name: string;
  description: string;
  leader: string;
  meetingSchedule: string;
  memberCount: number;
  isActive: boolean;
  leaderId?: string;
};

export type AttendanceRecord = {
  id: string;
  date: string;
  service: AttendanceService;
  adults: number;
  children: number;
  visitors: number;
  notes: string;
};
