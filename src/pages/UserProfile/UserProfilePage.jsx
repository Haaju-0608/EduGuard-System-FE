import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';

const menuItems = [
  { icon: '🏠', label: 'Dashboard', path: '/profile' },
  { icon: '📊', label: 'Attendance', path: '/profile/attendance' },
  { icon: '📅', label: 'Schedule', path: '/profile/schedule' },
  { icon: '📝', label: 'Exams', path: '/profile/exams' },
  { icon: '👤', label: 'My Profile', path: '/profile/me' },
  { icon: '⚙️', label: 'Settings', path: '/profile/settings' },
];

const kpiData = [
  {
    label: 'Attendance Rate',
    value: '85.2%',
    icon: '📊',
    color: 'text-green',
    bgColor: 'bg-green/10',
    borderHover: 'hover:border-green',
    change: '+2.1%',
    changeColor: 'text-green',
  },
  {
    label: 'Classes Today',
    value: '3',
    icon: '📚',
    color: 'text-blue-bright',
    bgColor: 'bg-blue-bright/10',
    borderHover: 'hover:border-blue-bright',
    change: null,
    changeColor: null,
  },
  {
    label: 'Upcoming Exams',
    value: '2',
    icon: '📝',
    color: 'text-gold',
    bgColor: 'bg-gold/10',
    borderHover: 'hover:border-gold',
    change: null,
    changeColor: null,
  },
  {
    label: 'Violations',
    value: '0',
    icon: '✅',
    color: 'text-green',
    bgColor: 'bg-green/10',
    borderHover: 'hover:border-green',
    change: null,
    changeColor: null,
  },
];

const scheduleItems = [
  {
    time: '07:30',
    name: 'Web Programming',
    room: 'A2-301',
    status: 'present',
    statusText: '✓ Present',
    statusColor: 'text-green',
    borderColor: 'border-l-green',
    bgAccent: 'bg-green/5',
  },
  {
    time: '09:45',
    name: 'Database Systems',
    room: 'B1-205',
    status: 'upcoming',
    statusText: 'Upcoming',
    statusColor: 'text-gold',
    borderColor: 'border-l-gold',
    bgAccent: 'bg-gold/5',
  },
  {
    time: '13:30',
    name: 'Math Midterm Exam',
    room: 'Hall A',
    status: 'exam',
    statusText: '🔴 Exam',
    statusColor: 'text-red',
    borderColor: 'border-l-red',
    bgAccent: 'bg-red/5',
  },
  {
    time: '15:00',
    name: 'Software Engineering',
    room: 'C3-102',
    status: 'later',
    statusText: 'Later',
    statusColor: 'text-muted',
    borderColor: 'border-l-[rgba(248,250,255,0.2)]',
    bgAccent: '',
  },
];

const recentAttendance = [
  { subject: 'Web Programming', date: 'May 30', status: '✓ Present', color: 'text-green', bgBadge: 'bg-green/10' },
  { subject: 'Database Systems', date: 'May 30', status: '✓ Present', color: 'text-green', bgBadge: 'bg-green/10' },
  { subject: 'Software Engineering', date: 'May 29', status: '✗ Absent', color: 'text-red', bgBadge: 'bg-red/10' },
  { subject: 'Math Analysis', date: 'May 29', status: '✓ Present', color: 'text-green', bgBadge: 'bg-green/10' },
  { subject: 'English Communication', date: 'May 28', status: '✓ Present', color: 'text-green', bgBadge: 'bg-green/10' },
];

const quickActions = [
  {
    icon: '📸',
    label: 'Register Face',
    style: 'bg-gradient-to-r from-gold to-green text-navy font-bold shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_32px_rgba(245,158,11,0.35)] hover:scale-[1.03]',
  },
  {
    icon: '📋',
    label: 'View Full History',
    style: 'bg-gradient-to-r from-blue to-blue-bright text-white font-bold shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_32px_rgba(37,99,235,0.35)] hover:scale-[1.03]',
  },
  {
    icon: '🔔',
    label: 'Notification Settings',
    style: 'bg-transparent border-2 border-cyan text-cyan font-bold hover:bg-cyan/10 hover:shadow-[0_0_24px_rgba(6,182,212,0.2)] hover:scale-[1.03]',
  },
];

function AttendanceRing() {
  const percentage = 85;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-[120px] h-[120px] flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="profileRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="6"
        />
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          stroke="url(#profileRingGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-ring-fill"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-syne font-extrabold text-2xl text-white-soft">{percentage}%</span>
        <span className="text-[10px] text-muted font-dm">Attendance</span>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const { user } = useAuth();
  const [hoveredKpi, setHoveredKpi] = useState(null);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <DashboardLayout menuItems={menuItems}>
      <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-slide-in">

        {/* ═══════════════════════════════════
            1. WELCOME BANNER
           ═══════════════════════════════════ */}
        <div className="bg-navy-card border border-border rounded-[20px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
          {/* Decorative glow */}
          <div
            className="absolute -top-20 -right-20 w-[200px] h-[200px] rounded-full blur-[80px] opacity-20 pointer-events-none transition-opacity duration-700 group-hover:opacity-35"
            style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }}
          />

          {/* Left content */}
          <div className="flex-1 z-10">
            <h1 className="font-syne text-2xl md:text-3xl font-extrabold text-white-soft mb-2">
              Good morning, {user?.name || 'Student'}! 👋
            </h1>
            <p className="text-muted font-dm text-sm md:text-base">
              {user?.studentId && (
                <span className="inline-flex items-center gap-1.5 mr-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-bright inline-block" />
                  ID: {user.studentId}
                </span>
              )}
              {user?.department && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan inline-block" />
                  {user.department}
                </span>
              )}
            </p>
            <p className="text-muted/70 text-xs mt-2 font-dm">{todayDate}</p>
          </div>

          {/* Right — Attendance ring */}
          <div className="z-10">
            <AttendanceRing />
          </div>
        </div>

        {/* ═══════════════════════════════════
            2. KPI ROW
           ═══════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, i) => (
            <div
              key={kpi.label}
              className={`bg-navy-card border rounded-[16px] p-5 cursor-default transition-all duration-300
                ${hoveredKpi === i ? `border-cyan -translate-y-0.5 shadow-[0_8px_32px_rgba(6,182,212,0.1)]` : 'border-border'}
              `}
              onMouseEnter={() => setHoveredKpi(i)}
              onMouseLeave={() => setHoveredKpi(null)}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-[42px] h-[42px] rounded-[12px] ${kpi.bgColor} flex items-center justify-center text-xl`}>
                  {kpi.icon}
                </div>
                {kpi.change && (
                  <span className={`text-xs font-semibold font-dm ${kpi.changeColor} bg-green/10 px-2 py-0.5 rounded-full`}>
                    {kpi.change}
                  </span>
                )}
              </div>
              <p className={`font-syne font-extrabold text-2xl ${kpi.color} mb-1`}>{kpi.value}</p>
              <p className="text-muted text-sm font-dm">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════
            3. TWO-COLUMN LAYOUT
           ═══════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">

          {/* ── LEFT: Today's Schedule ── */}
          <div className="bg-navy-card border border-border rounded-[20px] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-syne font-bold text-lg text-white-soft">Today's Schedule</h2>
                <p className="text-muted text-xs font-dm mt-0.5">{todayDate}</p>
              </div>
              <span className="text-xs text-muted font-dm bg-navy px-3 py-1.5 rounded-full border border-border">
                {scheduleItems.length} classes
              </span>
            </div>

            {/* Schedule items */}
            <div className="flex flex-col gap-3">
              {scheduleItems.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between bg-navy rounded-xl border-l-[3px] ${item.borderColor} px-4 py-3.5 transition-all duration-200 hover:translate-x-1 group/item ${item.bgAccent}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center min-w-[48px]">
                      <span className="text-sm font-mono font-bold text-white-soft">{item.time}</span>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div>
                      <p className="text-sm font-semibold text-white-soft font-dm group-hover/item:text-blue-bright transition-colors">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted font-dm mt-0.5">📍 {item.room}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold font-dm px-3 py-1 rounded-full ${item.statusColor} ${
                    item.status === 'present' ? 'bg-green/10' :
                    item.status === 'upcoming' ? 'bg-gold/10' :
                    item.status === 'exam' ? 'bg-red/10' :
                    'bg-white-soft/5'
                  }`}>
                    {item.statusText}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Recent Attendance ── */}
          <div className="bg-navy-card border border-border rounded-[20px] p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne font-bold text-lg text-white-soft">Recent Attendance</h2>
              <span className="text-xs text-blue-bright font-dm cursor-pointer hover:underline">View all</span>
            </div>

            {/* Records */}
            <div className="flex flex-col gap-2.5">
              {recentAttendance.map((record, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-navy rounded-xl px-4 py-3 transition-all duration-200 hover:bg-navy-mid group/record"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft font-dm truncate group-hover/record:text-blue-bright transition-colors">
                      {record.subject}
                    </p>
                    <p className="text-xs text-muted font-dm mt-0.5">{record.date}</p>
                  </div>
                  <span className={`text-xs font-bold font-dm px-3 py-1 rounded-full flex-shrink-0 ml-3 ${record.color} ${record.bgBadge}`}>
                    {record.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green" />
                <span className="text-xs text-muted font-dm">4 Present</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red" />
                <span className="text-xs text-muted font-dm">1 Absent</span>
              </div>
              <span className="text-xs font-bold text-green font-dm">80% rate</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════
            4. QUICK ACTIONS ROW
           ═══════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action, i) => (
            <div
              key={action.label}
              className="bg-navy-card border border-border rounded-[16px] p-5 flex flex-col items-center text-center transition-all duration-300 hover:border-cyan/40 group/action"
            >
              <span className="text-3xl mb-3 group-hover/action:scale-110 transition-transform duration-300">
                {action.icon}
              </span>
              <button
                className={`w-full rounded-xl py-2.5 px-4 text-sm font-syne cursor-pointer transition-all duration-300 border-0 ${action.style}`}
              >
                {action.label}
              </button>
            </div>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
