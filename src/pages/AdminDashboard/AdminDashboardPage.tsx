import React, { useState } from 'react';
import { FiSearch, FiChevronDown, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout, { MenuItem } from '../../components/layout/DashboardLayout';

const menuItems: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', path: '/admin' },
  { icon: '👥', label: 'Users', path: '/admin/users' },
  { icon: '📡', label: 'Live Monitor', path: '/admin/live' },
  { icon: '📊', label: 'Reports', path: '/admin/reports' },
  { icon: '💳', label: 'Credits', path: '/admin/credits' },
  { icon: '✅', label: 'Approvals', path: '/admin/approvals' },
  { icon: '⚙️', label: 'Settings', path: '/admin/settings' },
];

interface KpiCardData {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  colorClass: string;
  bgGlow: string;
  borderHover: string;
  change: string | null;
  changeColor?: string;
  sparkPath: string;
  sparkStroke: string;
  sparkColor: string;
}

/* ── KPI Data ── */
const kpiCards: KpiCardData[] = [
  {
    label: 'Total Students',
    value: '2,350',
    icon: '👥',
    colorClass: 'text-blue-bright',
    bgGlow: 'from-blue/10 to-blue-bright/5',
    borderHover: 'hover:border-blue-bright/50',
    change: '+12.5%',
    changeColor: 'text-green',
    sparkPath: 'M0,40 C20,38 30,30 50,32 C70,34 80,20 100,22 C120,24 140,15 160,18 C180,21 200,10 220,12 L220,60 L0,60 Z',
    sparkStroke: 'M0,40 C20,38 30,30 50,32 C70,34 80,20 100,22 C120,24 140,15 160,18 C180,21 200,10 220,12',
    sparkColor: 'var(--color-blue-bright)',
  },
  {
    label: 'Present Today',
    value: '1,890',
    subtitle: '80.4%',
    icon: '✅',
    colorClass: 'text-green',
    bgGlow: 'from-green/10 to-green/5',
    borderHover: 'hover:border-green/50',
    change: null,
    sparkPath: 'M0,35 C25,30 40,25 65,28 C90,31 100,18 130,20 C155,22 180,14 220,10 L220,60 L0,60 Z',
    sparkStroke: 'M0,35 C25,30 40,25 65,28 C90,31 100,18 130,20 C155,22 180,14 220,10',
    sparkColor: 'var(--color-green)',
  },
  {
    label: 'Active Exams',
    value: '18',
    icon: '📝',
    colorClass: 'text-cyan',
    bgGlow: 'from-cyan/10 to-cyan/5',
    borderHover: 'hover:border-cyan/50',
    change: '+3 new',
    changeColor: 'text-cyan',
    sparkPath: 'M0,32 C30,28 50,35 80,30 C110,25 130,32 160,22 C185,15 200,20 220,16 L220,60 L0,60 Z',
    sparkStroke: 'M0,32 C30,28 50,35 80,30 C110,25 130,32 160,22 C185,15 200,20 220,16',
    sparkColor: 'var(--color-cyan)',
  },
  {
    label: 'AI Credits',
    value: '12,450',
    icon: '💳',
    colorClass: 'text-gold',
    bgGlow: 'from-gold/10 to-gold/5',
    borderHover: 'hover:border-gold/50',
    change: null,
    sparkPath: 'M0,30 C30,25 55,35 80,28 C105,21 125,30 155,20 C175,14 200,18 220,14 L220,60 L0,60 Z',
    sparkStroke: 'M0,30 C30,25 55,35 80,28 C105,21 125,30 155,20 C175,14 200,18 220,14',
    sparkColor: 'var(--color-gold)',
  },
];

interface ActivityItem {
  icon: string;
  text: string;
  time: string;
  color: string;
}

/* ── Activities Data ── */
const activities: ActivityItem[] = [
  { icon: '✅', text: 'IT Class K21A checked in', time: '2 min ago', color: 'bg-green' },
  { icon: '🔴', text: 'Exam violation in Room B2-301', time: '5 min ago', color: 'bg-red' },
  { icon: '📤', text: 'May report exported', time: '15 min ago', color: 'bg-cyan' },
  { icon: '👥', text: 'Re-registration request #45', time: '1h ago', color: 'bg-gold' },
  { icon: '✅', text: 'CS101 attendance completed', time: '2h ago', color: 'bg-green' },
  { icon: '💳', text: '500 credits consumed', time: '3h ago', color: 'bg-gold' },
];

type UserRole = 'Student' | 'Instructor';
type UserStatus = 'Active' | 'Warning' | 'Suspended';

interface UserRecord {
  name: string;
  email: string;
  role: UserRole;
  dept: string;
  status: UserStatus;
}

/* ── Users Mock Data ── */
const users: UserRecord[] = [
  { name: 'Nguyen Van An', email: 'user@eduguard.com', role: 'Student', dept: 'IT', status: 'Active' },
  { name: 'Tran Thi Bao', email: 'bao.tran@edu.vn', role: 'Student', dept: 'CS', status: 'Active' },
  { name: 'Dr. Le Minh', email: 'leminh@edu.vn', role: 'Instructor', dept: 'Math', status: 'Active' },
  { name: 'Pham Duc', email: 'phamduc@edu.vn', role: 'Student', dept: 'IT', status: 'Warning' },
  { name: 'Vo Thi Lan', email: 'volan@edu.vn', role: 'Instructor', dept: 'English', status: 'Active' },
  { name: 'Bui Kim', email: 'buikim@edu.vn', role: 'Student', dept: 'CS', status: 'Suspended' },
];

const statusConfig: Record<UserStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: 'bg-green/15', text: 'text-green', border: 'border-green/25' },
  Warning: { bg: 'bg-gold/15', text: 'text-gold', border: 'border-gold/25' },
  Suspended: { bg: 'bg-red/15', text: 'text-red', border: 'border-red/25' },
};

/* ── KPI Card Component ── */
interface KpiCardProps {
  card: KpiCardData;
  index: number;
}

function KpiCard({ card, index }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-navy-card border border-border rounded-[16px] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(6,182,212,0.08)] ${card.borderHover} group animate-fade-slide-in`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Sparkline background decoration */}
      <svg
        className="absolute bottom-0 right-0 w-[220px] h-[60px] opacity-[0.12] group-hover:opacity-[0.22] transition-opacity duration-500"
        viewBox="0 0 220 60"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`spark-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={card.sparkColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={card.sparkColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={card.sparkPath} fill={`url(#spark-fill-${index})`} />
        <path d={card.sparkStroke} fill="none" stroke={card.sparkColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted font-dm text-sm font-medium">{card.label}</span>
          <span className="text-xl">{card.icon}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className={`font-syne font-extrabold text-[1.75rem] leading-none ${card.colorClass}`}>
            {card.value}
          </span>
          {card.subtitle && (
            <span className="text-muted text-sm font-dm mb-0.5">/ {card.subtitle}</span>
          )}
        </div>
        {card.change && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${card.changeColor}`}>
            <FiTrendingUp className="text-[0.7rem]" />
            <span>{card.change}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Attendance Chart Component ── */
function AttendanceChart() {
  return (
    <div className="bg-navy-card border border-border rounded-[16px] p-5 transition-all duration-300 hover:border-cyan/30 animate-fade-slide-in-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-syne font-bold text-white-soft text-base">Attendance Overview</h3>
        <span className="bg-cyan/10 text-cyan text-xs font-medium font-dm px-3 py-1 rounded-full border border-cyan/20">
          Last 7 Days
        </span>
      </div>

      {/* SVG Chart */}
      <div className="w-full">
        <svg viewBox="0 0 300 120" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-green)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-green)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-red)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-red)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[20, 40, 60, 80, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4,4" />
          ))}

          {/* Day labels */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <text key={day} x={21.5 + i * 42.8} y="116" textAnchor="middle" fill="var(--color-muted)" fontSize="7" fontFamily="DM Sans">
              {day}
            </text>
          ))}

          {/* Green area — Present */}
          <path
            d="M0,55 C15,50 30,42 50,38 C70,34 85,30 107,28 C130,26 150,32 171,30 C193,28 215,22 235,25 C255,28 275,20 300,18 L300,105 L0,105 Z"
            fill="url(#greenGrad)"
          />
          <path
            d="M0,55 C15,50 30,42 50,38 C70,34 85,30 107,28 C130,26 150,32 171,30 C193,28 215,22 235,25 C255,28 275,20 300,18"
            fill="none"
            stroke="var(--color-green)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Green dots */}
          {[[0, 55], [50, 38], [107, 28], [150, 32], [193, 28], [235, 25], [300, 18]].map(([cx, cy], i) => (
            <circle key={`g${i}`} cx={cx} cy={cy} r="2.5" fill="var(--color-green)" opacity="0.9" />
          ))}

          {/* Red area — Absent */}
          <path
            d="M0,90 C15,88 30,85 50,86 C70,87 85,82 107,84 C130,86 150,80 171,82 C193,84 215,78 235,80 C255,82 275,76 300,78 L300,105 L0,105 Z"
            fill="url(#redGrad)"
          />
          <path
            d="M0,90 C15,88 30,85 50,86 C70,87 85,82 107,84 C130,86 150,80 171,82 C193,84 215,78 235,80 C255,82 275,76 300,78"
            fill="none"
            stroke="var(--color-red)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="4,3"
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green" />
          <span className="text-xs text-muted font-dm">Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red" />
          <span className="text-xs text-muted font-dm">Absent</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Average', value: '82.4%', color: 'text-blue-bright' },
          { label: 'Highest', value: '91.2%', color: 'text-green' },
          { label: 'Lowest', value: '74.8%', color: 'text-red' },
        ].map((stat) => (
          <div key={stat.label} className="bg-navy/60 rounded-xl py-2.5 px-3 text-center border border-border/50">
            <p className="text-[11px] text-muted font-dm mb-0.5">{stat.label}</p>
            <p className={`font-syne font-bold text-sm ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recent Activities Component ── */
function RecentActivities() {
  return (
    <div className="bg-navy-card border border-border rounded-[16px] p-5 transition-all duration-300 hover:border-cyan/30 animate-fade-slide-in-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-syne font-bold text-white-soft text-base">Recent Activities</h3>
        <span className="text-xs text-cyan cursor-pointer hover:underline font-dm">View All</span>
      </div>

      {/* Activity list */}
      <div className="flex flex-col gap-0.5">
        {activities.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-3 px-2 rounded-xl transition-all duration-200 hover:bg-navy/50 group cursor-pointer"
          >
            {/* Colored dot indicator */}
            <div className="mt-1.5 flex-shrink-0">
              <span className={`block w-2 h-2 rounded-full ${item.color} shadow-[0_0_6px] ${item.color === 'bg-green' ? 'shadow-green/40' : item.color === 'bg-red' ? 'shadow-red/40' : item.color === 'bg-cyan' ? 'shadow-cyan/40' : 'shadow-gold/40'}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm">{item.icon}</span>
                <p className="text-sm text-white-soft font-dm truncate group-hover:text-cyan transition-colors">
                  {item.text}
                </p>
              </div>
              <p className="text-[11px] text-muted font-dm">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── User Management Table Component ── */
function UserManagementTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'All Roles' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="bg-navy-card border border-border rounded-[16px] p-5 transition-all duration-300 hover:border-cyan/30 animate-fade-slide-in-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h3 className="font-syne font-bold text-white-soft text-base">User Management</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="flex items-center gap-2 bg-navy border border-border rounded-xl py-2 px-3 flex-1 sm:w-[200px] focus-within:border-blue-bright/40 transition-colors">
            <FiSearch className="text-muted text-sm flex-shrink-0" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted w-full font-dm"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none bg-navy border border-border rounded-xl py-2 pl-3 pr-8 text-sm text-white-soft font-dm cursor-pointer focus:border-blue-bright/40 outline-none transition-colors"
            >
              <option>All Roles</option>
              <option>Student</option>
              <option>Instructor</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm font-dm">
          <thead>
            <tr className="bg-navy-card">
              <th className="text-left py-3 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Name</th>
              <th className="text-left py-3 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border hidden sm:table-cell">Email</th>
              <th className="text-left py-3 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Role</th>
              <th className="text-left py-3 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border hidden md:table-cell">Department</th>
              <th className="text-left py-3 px-4 text-muted font-medium text-xs uppercase tracking-wider border-b border-border">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u, i) => {
              const sc = statusConfig[u.status];
              return (
                <tr
                  key={i}
                  className={`${i % 2 === 0 ? 'bg-navy/40' : 'bg-navy-card/60'} hover:bg-cyan/5 transition-colors cursor-pointer group`}
                >
                  <td className="py-3 px-4 border-b border-border/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[30px] h-[30px] min-w-[30px] rounded-full bg-linear-to-br from-blue to-cyan grid place-items-center text-white text-[10px] font-syne font-bold">
                        {u.name.split(' ').map(n => n[0]).slice(-2).join('')}
                      </div>
                      <span className="text-white-soft font-medium group-hover:text-cyan transition-colors">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted border-b border-border/30 hidden sm:table-cell">{u.email}</td>
                  <td className="py-3 px-4 border-b border-border/30">
                    <span className={`text-xs font-medium ${u.role === 'Instructor' ? 'text-cyan' : 'text-blue-bright'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted border-b border-border/30 hidden md:table-cell">{u.dept}</td>
                  <td className="py-3 px-4 border-b border-border/30">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Quick Actions Component ── */
function QuickActions() {
  const actions = [
    {
      icon: '📊',
      label: 'Generate Report',
      style: 'bg-linear-to-r from-blue to-blue-bright text-white shadow-[0_4px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_6px_28px_rgba(37,99,235,0.45)] hover:-translate-y-0.5',
    },
    {
      icon: '👥',
      label: 'Manage Users',
      style: 'bg-transparent text-cyan border border-cyan/40 hover:bg-cyan/10 hover:border-cyan/70 hover:-translate-y-0.5',
    },
    {
      icon: '📡',
      label: 'Live Monitor',
      style: 'bg-transparent text-green border border-green/40 hover:bg-green/10 hover:border-green/70 hover:-translate-y-0.5',
    },
    {
      icon: '⚙️',
      label: 'System Settings',
      style: 'bg-transparent text-muted border border-border hover:bg-navy-mid hover:border-muted/40 hover:text-white-soft hover:-translate-y-0.5',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-slide-in-4">
      {actions.map((action) => (
        <button
          key={action.label}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 font-semibold font-dm text-sm cursor-pointer transition-all duration-300 ${action.style}`}
        >
          <span className="text-base">{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   ADMIN DASHBOARD PAGE
   ═══════════════════════════════════════ */
export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* ── Page Header ── */}
        <div className="animate-fade-slide-in">
          <h1 className="font-syne font-extrabold text-2xl text-white-soft">
            Welcome back, <span className="text-gradient-blue-cyan">{user?.name || 'Admin'}</span>
          </h1>
          <p className="text-muted font-dm text-sm mt-1">
            Here&apos;s what&apos;s happening across EduGuard today.
          </p>
        </div>

        {/* ── 1. KPI Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <KpiCard key={card.label} card={card} index={i} />
          ))}
        </div>

        {/* ── 2. Two-column: Chart + Activities ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left — Attendance Chart (3/5 = ~60%) */}
          <div className="lg:col-span-3">
            <AttendanceChart />
          </div>

          {/* Right — Recent Activities (2/5 = ~40%) */}
          <div className="lg:col-span-2">
            <RecentActivities />
          </div>
        </div>

        {/* ── 3. User Management Table ── */}
        <UserManagementTable />

        {/* ── 4. Quick Actions ── */}
        <QuickActions />
      </div>
    </DashboardLayout>
  );
}
