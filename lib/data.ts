export type StatusTone = "blue" | "green" | "gold" | "slate" | "red";

export const events = [
  { date: "06", month: "JUN", title: "Youth Prayer & Worship Night", time: "18:30 - 21:00", location: "Main Sanctuary", type: "Youth" },
  { date: "13", month: "JUN", title: "Community Health Outreach", time: "10:00 - 15:00", location: "Hamburg-Mitte", type: "Outreach" },
  { date: "20", month: "JUN", title: "Family Sabbath & Fellowship", time: "09:30 - 17:00", location: "Church Hall", type: "Church" },
  { date: "27", month: "JUN", title: "Choir Anniversary Concert", time: "17:00 - 20:00", location: "Main Sanctuary", type: "Music" },
];

export const announcements = [
  { title: "Quarterly Business Meeting", body: "All church members are invited to our quarterly business meeting after service.", date: "May 28, 2026", audience: "All Members", author: "Church Secretary" },
  { title: "Pathfinder Registration Open", body: "Registration for the new Pathfinder year is now open for children ages 10 to 15.", date: "May 24, 2026", audience: "Parents", author: "Youth Ministry" },
  { title: "Community Food Drive", body: "Please bring non-perishable food donations for our Hamburg community outreach.", date: "May 19, 2026", audience: "All Members", author: "Outreach Team" },
];

export const attendance = [
  { date: "May 30, 2026", service: "Sabbath Worship Service", adults: 238, children: 42, visitors: 18, total: 298 },
  { date: "May 23, 2026", service: "Sabbath Worship Service", adults: 224, children: 39, visitors: 12, total: 275 },
  { date: "May 16, 2026", service: "Sabbath Worship Service", adults: 231, children: 44, visitors: 16, total: 291 },
  { date: "May 09, 2026", service: "Sabbath Worship Service", adults: 218, children: 41, visitors: 9, total: 268 },
];

export const offerings = [
  { date: "May 30, 2026", category: "Tithe", amount: "€3,680.00", method: "Bank & Cash", recordedBy: "Ruth Amoah" },
  { date: "May 30, 2026", category: "Church Offering", amount: "€1,240.00", method: "Cash", recordedBy: "Ruth Amoah" },
  { date: "May 23, 2026", category: "Tithe", amount: "€3,150.00", method: "Bank & Cash", recordedBy: "Ruth Amoah" },
  { date: "May 23, 2026", category: "Building Fund", amount: "€860.00", method: "Bank Transfer", recordedBy: "Ruth Amoah" },
];

export const users = [
  { name: "Pastor Emmanuel Darko", email: "pastor@hamburgghanasda.de", role: "Pastor", status: "Active", lastLogin: "Today, 08:42" },
  { name: "Ruth Amoah", email: "treasury@hamburgghanasda.de", role: "Treasurer", status: "Active", lastLogin: "Today, 09:18" },
  { name: "Grace Appiah", email: "secretary@hamburgghanasda.de", role: "Secretary", status: "Active", lastLogin: "Yesterday, 18:05" },
  { name: "Samuel Asare", email: "youth@hamburgghanasda.de", role: "Department Head", status: "Active", lastLogin: "May 28, 2026" },
  { name: "Kwame Mensah", email: "elder@hamburgghanasda.de", role: "Elder", status: "Active", lastLogin: "May 26, 2026" },
];
