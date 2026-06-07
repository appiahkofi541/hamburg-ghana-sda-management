export type StatusTone = "blue" | "green" | "gold" | "slate" | "red";

export const members = [
  { id: "HG-001", name: "Kwame Mensah", email: "kwame.mensah@email.com", phone: "+49 176 482 0193", department: "Deacons", status: "Active", joined: "Jan 14, 2021" },
  { id: "HG-002", name: "Akosua Boateng", email: "akosua.boateng@email.com", phone: "+49 157 594 2281", department: "Choir", status: "Active", joined: "Mar 02, 2022" },
  { id: "HG-003", name: "Samuel Asare", email: "samuel.asare@email.com", phone: "+49 176 319 8724", department: "Youth Ministry", status: "Active", joined: "Nov 18, 2020" },
  { id: "HG-004", name: "Esi Owusu", email: "esi.owusu@email.com", phone: "+49 152 737 4309", department: "Women Ministry", status: "Active", joined: "Aug 26, 2023" },
  { id: "HG-005", name: "Daniel Ofori", email: "daniel.ofori@email.com", phone: "+49 176 967 5110", department: "Media Team", status: "New", joined: "May 10, 2026" },
];

export const departments = [
  { name: "Youth Ministry", lead: "Samuel Asare", members: 74, meeting: "Saturdays, 16:00", color: "bg-blue-100 text-blue-700" },
  { name: "Choir & Music", lead: "Akosua Boateng", members: 38, meeting: "Fridays, 18:30", color: "bg-purple-100 text-purple-700" },
  { name: "Women Ministry", lead: "Esi Owusu", members: 92, meeting: "1st Sunday, 14:00", color: "bg-rose-100 text-rose-700" },
  { name: "Deacons", lead: "Kwame Mensah", members: 26, meeting: "Monthly", color: "bg-emerald-100 text-emerald-700" },
  { name: "Media Team", lead: "Daniel Ofori", members: 16, meeting: "Saturdays, 08:30", color: "bg-amber-100 text-amber-700" },
  { name: "Children Ministry", lead: "Adwoa Nyarko", members: 48, meeting: "Saturdays, 09:15", color: "bg-cyan-100 text-cyan-700" },
];

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
