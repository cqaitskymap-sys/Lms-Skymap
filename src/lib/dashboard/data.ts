import type { LucideIcon } from "lucide-react";
import {
  Users,
  UserPlus,
  FileText,
  GraduationCap,
  ClipboardList,
  Award,
  BarChart3,
  Bell,
  Shield,
  BookOpen,
  Calendar,
  Target,
  Briefcase,
} from "lucide-react";

export interface DashStat {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  tone?: "default" | "success" | "warning" | "danger";
}

export interface DashTrainingItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: string;
  progress?: number;
  href?: string;
}

export interface DashTask {
  id: string;
  title: string;
  due: string;
  priority: "high" | "medium" | "low";
  href?: string;
  done?: boolean;
}

export interface DashAlert {
  id: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  time: string;
  href?: string;
}

export interface DashQuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface DashNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  unread?: boolean;
  href?: string;
}

export interface DashActivity {
  id: string;
  description: string;
  actor: string;
  action: string;
  timestamp: string;
}

export const COMPLIANCE_TREND = [
  { month: "Feb", rate: 78 },
  { month: "Mar", rate: 81 },
  { month: "Apr", rate: 83 },
  { month: "May", rate: 85 },
  { month: "Jun", rate: 86 },
  { month: "Jul", rate: 87.5 },
];

export const TRAINING_PROGRESS_SERIES = [
  { name: "Week 1", completed: 12, inProgress: 8, overdue: 2 },
  { name: "Week 2", completed: 18, inProgress: 10, overdue: 3 },
  { name: "Week 3", completed: 22, inProgress: 9, overdue: 2 },
  { name: "Week 4", completed: 28, inProgress: 7, overdue: 1 },
];

export const DEPT_COMPLIANCE = [
  { name: "QA", rate: 92 },
  { name: "Production", rate: 84 },
  { name: "Warehouse", rate: 78 },
  { name: "QC", rate: 88 },
];

export const STATUS_DISTRIBUTION = [
  { name: "Passed", value: 45, color: "hsl(152, 61%, 36%)" },
  { name: "In progress", value: 18, color: "hsl(199, 89%, 40%)" },
  { name: "Retraining", value: 7, color: "hsl(25, 95%, 45%)" },
  { name: "Overdue", value: 4, color: "hsl(0, 72%, 51%)" },
];

export const UPCOMING_TRAININGS: DashTrainingItem[] = [
  {
    id: "up_1",
    title: "Deviation Management",
    subtitle: "Classroom · 8 attendees",
    date: "2026-07-24T10:00:00.000Z",
    status: "scheduled",
    href: "/dashboard/training/sessions/ts_001",
  },
  {
    id: "up_2",
    title: "Document Control Refresh",
    subtitle: "Self-paced · SOP-QA-001",
    date: "2026-07-25T09:00:00.000Z",
    status: "assigned",
    href: "/dashboard/training",
  },
  {
    id: "up_3",
    title: "GMP Induction Module 2",
    subtitle: "New joiners",
    date: "2026-07-26T11:00:00.000Z",
    status: "scheduled",
    href: "/dashboard/induction",
  },
];

export const OVERDUE_TRAININGS: DashTrainingItem[] = [
  {
    id: "od_1",
    title: "Change Control Basics",
    subtitle: "Neha Gupta · EMP-PRD-0002",
    date: "2026-07-15T00:00:00.000Z",
    status: "overdue",
    progress: 35,
    href: "/dashboard/training",
  },
  {
    id: "od_2",
    title: "Warehouse Safety SOP",
    subtitle: "Rohan Das · EMP-WH-0003",
    date: "2026-07-12T00:00:00.000Z",
    status: "overdue",
    progress: 10,
    href: "/dashboard/training",
  },
];

export const TODAY_TASKS: DashTask[] = [
  {
    id: "task_1",
    title: "Verify new joiner Rohan Das",
    due: "Today 14:00",
    priority: "high",
    href: "/dashboard/employees/emp_003",
  },
  {
    id: "task_2",
    title: "Approve SOP revision SOP-QA-002",
    due: "Today 16:00",
    priority: "high",
    href: "/dashboard/sops",
  },
  {
    id: "task_3",
    title: "Review pending assessments",
    due: "Today 17:30",
    priority: "medium",
    href: "/dashboard/exams",
  },
  {
    id: "task_4",
    title: "Export weekly compliance report",
    due: "Today EOD",
    priority: "low",
    href: "/dashboard/reports",
  },
];

export const AUDIT_ALERTS: DashAlert[] = [
  {
    id: "aa_1",
    title: "Failed login lockout",
    message: "Account locked after 5 failed attempts (employee@…)",
    severity: "warning",
    time: "12 min ago",
    href: "/dashboard/audit",
  },
  {
    id: "aa_2",
    title: "Privilege elevation",
    message: "Role change requested for department user",
    severity: "critical",
    time: "1 hr ago",
    href: "/dashboard/audit",
  },
  {
    id: "aa_3",
    title: "Bulk export",
    message: "Audit log export downloaded by HR",
    severity: "info",
    time: "3 hr ago",
    href: "/dashboard/audit",
  },
];

export const SOP_REVISION_ALERTS: DashAlert[] = [
  {
    id: "sop_1",
    title: "SOP-QA-002 under review",
    message: "Deviation Management v2.0 awaiting QA approval",
    severity: "warning",
    time: "Today",
    href: "/dashboard/sops",
  },
  {
    id: "sop_2",
    title: "Retraining triggered",
    message: "12 employees reassigned after Document Control revision",
    severity: "critical",
    time: "Yesterday",
    href: "/dashboard/matrix",
  },
];

export const DASH_NOTIFICATIONS: DashNotification[] = [
  {
    id: "n1",
    title: "Assessment ready",
    message: "Deviation Management assessment is available",
    time: "10 min ago",
    unread: true,
    href: "/dashboard/exams",
  },
  {
    id: "n2",
    title: "SOP revision",
    message: "New version published for Document Control",
    time: "1 hr ago",
    unread: true,
    href: "/dashboard/sops",
  },
  {
    id: "n3",
    title: "Certificate issued",
    message: "Aarav Kumar certified on SOP-QA-001",
    time: "Yesterday",
    href: "/dashboard/certificates",
  },
];

export const DASH_ACTIVITIES: DashActivity[] = [
  {
    id: "act1",
    description: "Created employee profile EMP-WH-0003",
    actor: "hr@pharma.local",
    action: "create",
    timestamp: "2026-07-20T10:00:00.000Z",
  },
  {
    id: "act2",
    description: "Submitted SOP-QA-002 for review",
    actor: "qa@pharma.local",
    action: "update",
    timestamp: "2026-07-20T11:30:00.000Z",
  },
  {
    id: "act3",
    description: "Marked attendance for training session",
    actor: "trainer@pharma.local",
    action: "update",
    timestamp: "2026-07-20T14:00:00.000Z",
  },
  {
    id: "act4",
    description: "Issued certificate CERT-2026-100421",
    actor: "system",
    action: "create",
    timestamp: "2026-07-19T16:20:00.000Z",
  },
];

export const CALENDAR_EVENTS = [
  { date: 23, label: "Today", tone: "primary" as const },
  { date: 24, label: "Deviation training", tone: "accent" as const },
  { date: 25, label: "Doc control", tone: "accent" as const },
  { date: 26, label: "Induction", tone: "warning" as const },
  { date: 28, label: "Audit review", tone: "danger" as const },
];

export function roleQuickActions(role: string): DashQuickAction[] {
  switch (role) {
    case "hr":
      return [
        { label: "Add employee", href: "/dashboard/employees/new", icon: UserPlus },
        { label: "Induction", href: "/dashboard/induction", icon: GraduationCap },
        { label: "Employees", href: "/dashboard/employees", icon: Users },
        { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      ];
    case "qa":
      return [
        { label: "New SOP", href: "/dashboard/sops/new", icon: FileText },
        { label: "SOP register", href: "/dashboard/sops", icon: BookOpen },
        { label: "Matrix", href: "/dashboard/matrix", icon: ClipboardList },
        { label: "Audit", href: "/dashboard/audit", icon: Shield },
      ];
    case "department_head":
      return [
        { label: "Create JD", href: "/dashboard/jd", icon: Briefcase },
        { label: "Create TNI", href: "/dashboard/tni", icon: Target },
        { label: "Assign training", href: "/dashboard/training", icon: GraduationCap },
        { label: "Team matrix", href: "/dashboard/matrix", icon: ClipboardList },
      ];
    case "trainer":
      return [
        { label: "Sessions", href: "/dashboard/training", icon: Calendar },
        { label: "Attendance", href: "/dashboard/training", icon: ClipboardList },
        { label: "SOPs", href: "/dashboard/sops", icon: FileText },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      ];
    case "employee":
      return [
        { label: "My training", href: "/dashboard/training", icon: GraduationCap },
        { label: "Take exam", href: "/dashboard/exams", icon: ClipboardList },
        { label: "Certificates", href: "/dashboard/certificates", icon: Award },
        { label: "Induction", href: "/dashboard/induction", icon: BookOpen },
      ];
    default:
      return [
        { label: "Employees", href: "/dashboard/employees", icon: Users },
        { label: "SOPs", href: "/dashboard/sops", icon: FileText },
        { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
        { label: "Audit", href: "/dashboard/audit", icon: Shield },
      ];
  }
}

export function roleStats(role: string): DashStat[] {
  const base: DashStat[] = [
    {
      title: "Compliance",
      value: "87.5%",
      icon: Shield,
      trend: { value: 2.4, label: "vs last month" },
      tone: "success",
    },
    {
      title: "Active trainings",
      value: 5,
      icon: GraduationCap,
      description: "Across departments",
    },
    {
      title: "Overdue",
      value: 1,
      icon: ClipboardList,
      tone: "danger",
      description: "Needs attention",
    },
    {
      title: "Certificates",
      value: 12,
      icon: Award,
      tone: "success",
    },
  ];

  if (role === "hr") {
    return [
      { title: "Employees", value: 3, icon: Users, description: "Workforce" },
      { title: "Pending verification", value: 1, icon: Shield, tone: "warning" },
      { title: "Induction in progress", value: 1, icon: GraduationCap },
      { title: "Ready for handover", value: 0, icon: UserPlus, tone: "success" },
    ];
  }
  if (role === "qa") {
    return [
      { title: "Total SOPs", value: 2, icon: FileText },
      { title: "Under review", value: 1, icon: ClipboardList, tone: "warning" },
      { title: "Revisions (month)", value: 2, icon: BookOpen },
      { title: "Compliance", value: "87.5%", icon: Shield, tone: "success" },
    ];
  }
  if (role === "department_head") {
    return [
      { title: "Team members", value: 2, icon: Users },
      { title: "Open JDs", value: 1, icon: Briefcase },
      { title: "Open TNIs", value: 1, icon: Target },
      { title: "Dept compliance", value: "92%", icon: Shield, tone: "success" },
    ];
  }
  if (role === "trainer") {
    return [
      { title: "Upcoming sessions", value: 1, icon: Calendar },
      { title: "Trainees this week", value: 14, icon: Users },
      { title: "Completed sessions", value: 12, icon: Award, tone: "success" },
      { title: "Pending attendance", value: 1, icon: ClipboardList, tone: "warning" },
    ];
  }
  if (role === "employee") {
    return [
      { title: "My trainings", value: 2, icon: GraduationCap },
      { title: "Assessments due", value: 1, icon: ClipboardList, tone: "warning" },
      { title: "Certificates", value: 1, icon: Award, tone: "success" },
      { title: "My compliance", value: "100%", icon: Shield, tone: "success" },
    ];
  }
  return [
    { title: "Employees", value: 3, icon: Users, description: "Active workforce" },
    ...base,
  ].slice(0, 4);
}
