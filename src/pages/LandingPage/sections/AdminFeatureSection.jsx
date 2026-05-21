import { useState } from 'react';

const features = [
  {
    icon: '👥',
    title: 'Instructor & Student Management',
    desc: 'Create, modify, and assign permissions for accounts system-wide.',
    hoverBorder: 'border-blue-bright',
    iconBg: 'bg-blue-bright/15',
  },
  {
    icon: '📡',
    title: 'Real-time Monitoring',
    desc: 'Live tracking dashboard updated every single second.',
    hoverBorder: 'border-cyan',
    iconBg: 'bg-cyan/15',
  },
  {
    icon: '📤',
    title: 'Comprehensive Report Export',
    desc: 'Export PDF/Excel files for attendance, violations, and credits reports.',
    hoverBorder: 'border-green',
    iconBg: 'bg-green/15',
  },
  {
    icon: '💳',
    title: 'AI Wallet & Credit Management',
    desc: 'Track credits consumed for AI recognition & live proctoring.',
    hoverBorder: 'border-gold',
    iconBg: 'bg-gold/15',
  },
  {
    icon: '✅',
    title: 'Biometric Re-registration Approval',
    desc: 'Approve or reject student facial re-registration requests.',
    hoverBorder: 'border-[#8B5CF6]',
    iconBg: 'bg-[#8B5CF6]/15',
  },
];

const kpis = [
  { value: '2,350', label: 'Students', change: '+12.5%', changeColor: 'text-green', borderColor: 'border-blue-bright/30' },
  { value: '1,890', label: 'Present Today', change: '80.4%', changeColor: 'text-green', borderColor: 'border-green/30' },
  { value: '18', label: 'Exams', change: '+3', changeColor: 'text-cyan', borderColor: 'border-cyan/30' },
  { value: '12,450', label: 'Credits', change: '', changeColor: '', borderColor: 'border-gold/30' },
];

const recentActivities = [
  { icon: '✅', text: 'IT Class K21A checked in', time: '2 mins ago', color: 'text-green' },
  { icon: '🔴', text: 'Exam violation in Room B2-301', time: '5 mins ago', color: 'text-red' },
  { icon: '📤', text: 'May report exported successfully', time: '15 mins ago', color: 'text-cyan' },
  { icon: '👥', text: 'Re-registration request #45', time: '1 hour ago', color: 'text-gold' },
];

export default function AdminFeatureSection() {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <section id="admin-feature" className="relative bg-navy-mid py-24 px-6 overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center feature-grid-responsive">
        {/* LEFT — Dashboard Mockup */}
        <div className="relative flex justify-center items-center">
          {/* Glow orb */}
          <div
            className="absolute w-[380px] h-[380px] rounded-full blur-[90px] opacity-25 animate-pulse-glow"
            style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
          />

          {/* Dashboard card */}
          <div className="relative w-full max-w-[420px] bg-navy-card border border-blue-bright/30 rounded-[20px] p-4 animate-float shadow-[0_0_60px_rgba(37,99,235,0.12)]">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-syne font-bold text-sm text-white-soft">Dashboard · School Admin</h3>
                <p className="text-[10px] text-muted">May 21, 2025 · Semester 2</p>
              </div>
              <div className="flex items-center gap-2 text-muted text-sm">
                <span>🔔</span>
                <span>👤</span>
              </div>
            </div>

            {/* KPI boxes */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {kpis.map((kpi, i) => (
                <div key={i} className={`bg-navy rounded-xl border ${kpi.borderColor} p-3`}>
                  <p className="font-syne font-extrabold text-lg text-white-soft">{kpi.value}</p>
                  <p className="text-[10px] text-muted">{kpi.label}</p>
                  {kpi.change && (
                    <span className={`text-[9px] font-bold ${kpi.changeColor}`}>{kpi.change}</span>
                  )}
                </div>
              ))}
            </div>

            {/* SVG Mini chart */}
            <div className="bg-navy rounded-xl border border-border p-3 mb-4">
              <p className="text-[10px] text-muted font-syne font-bold mb-2 uppercase tracking-wider">Attendance Overview</p>
              <svg viewBox="0 0 300 80" className="w-full h-[60px]">
                <defs>
                  <linearGradient id="chartGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="chartRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Green area — attendance */}
                <path
                  d="M0,60 Q30,45 60,40 T120,30 T180,25 T240,35 T300,20 L300,80 L0,80 Z"
                  fill="url(#chartGreen)"
                />
                <path
                  d="M0,60 Q30,45 60,40 T120,30 T180,25 T240,35 T300,20"
                  fill="none" stroke="#10B981" strokeWidth="2"
                />
                {/* Red area — absences */}
                <path
                  d="M0,70 Q30,68 60,72 T120,65 T180,70 T240,62 T300,68 L300,80 L0,80 Z"
                  fill="url(#chartRed)"
                />
                <path
                  d="M0,70 Q30,68 60,72 T120,65 T180,70 T240,62 T300,68"
                  fill="none" stroke="#EF4444" strokeWidth="1.5"
                />
              </svg>
              <div className="flex gap-4 mt-2">
                <span className="text-[9px] text-green flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green inline-block" /> Present
                </span>
                <span className="text-[9px] text-red flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red inline-block" /> Absent
                </span>
              </div>
            </div>

            {/* Bottom 2 cols */}
            <div className="grid grid-cols-2 gap-3">
              {/* Recent activities */}
              <div className="bg-navy rounded-xl border border-border p-2.5">
                <p className="text-[9px] text-muted font-syne font-bold mb-2 uppercase tracking-wider">Recent</p>
                <div className="flex flex-col gap-1.5">
                  {recentActivities.map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className={`text-[10px] ${a.color}`}>{a.icon}</span>
                      <div>
                        <p className="text-[9px] text-white-soft leading-tight">{a.text}</p>
                        <p className="text-[8px] text-muted">{a.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-navy rounded-xl border border-border p-2.5">
                <p className="text-[9px] text-muted font-syne font-bold mb-2 uppercase tracking-wider">Quick Actions</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {['📊 Reports', '👥 Users', '📡 Live', '⚙ Settings'].map((label, i) => (
                    <button
                      key={i}
                      className="bg-blue-bright/10 border border-blue-bright/20 rounded-lg py-1.5 text-[8px] text-blue-bright font-bold hover:bg-blue-bright/20 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="absolute -left-4 top-[20%] bg-navy-card border border-green/30 rounded-xl px-3 py-2 text-[10px] text-green font-semibold shadow-lg animate-float-badge whitespace-nowrap">
            📊 Report exported successfully
          </div>
          <div className="absolute -right-4 bottom-[20%] bg-navy-card border border-red/30 rounded-xl px-3 py-2 text-[10px] text-red font-semibold shadow-lg animate-float-badge-delay whitespace-nowrap">
            🚨 3 new violations
          </div>
        </div>

        {/* RIGHT — Content */}
        <div>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-6 section-label-line">
            <span className="text-blue-bright font-dm text-sm font-semibold uppercase tracking-[0.15em]">
              For Administrators
            </span>
          </div>

          {/* Title */}
          <h2 className="font-syne text-[2.5rem] lg:text-[3rem] font-extrabold leading-[1.15] mb-5">
            School-wide management,
            <br />
            <span className="text-gradient-blue-cyan">absolute control</span>
          </h2>

          {/* Description */}
          <p className="text-muted text-lg leading-relaxed mb-10 max-w-[500px]">
            A centralized dashboard helps administrators monitor all activities: attendance sessions, exams, violations, and AI credits management — all in a single beautiful interface.
          </p>

          {/* Feature cards */}
          <div className="flex flex-col gap-3 mb-10">
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 bg-navy-card border rounded-[14px] p-4 cursor-default transition-all duration-300 ${
                  hoveredCard === i
                    ? `${f.hoverBorder} translate-x-1.5`
                    : 'border-border'
                }`}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className={`w-[44px] h-[44px] min-w-[44px] rounded-[12px] ${f.iconBg} flex items-center justify-center text-xl`}>
                  {f.icon}
                </div>
                <div>
                  <h4 className="font-syne font-bold text-white-soft text-[0.95rem] mb-1">{f.title}</h4>
                  <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="#"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-syne font-bold text-sm text-white-soft
              bg-gradient-to-r from-blue to-blue-bright shadow-[0_0_24px_rgba(37,99,235,0.3)]
              hover:shadow-[0_0_32px_rgba(37,99,235,0.5)] hover:scale-105 transition-all duration-300"
          >
            🚀 View Admin Dashboard Demo
          </a>
        </div>
      </div>
    </section>
  );
}
