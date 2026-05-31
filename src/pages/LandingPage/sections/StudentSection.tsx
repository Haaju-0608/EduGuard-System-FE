import React, { useState } from 'react';

interface Feature {
  icon: string;
  title: string;
  desc: string;
  hoverBorder: string;
  iconBg: string;
}

interface ScheduleItem {
  time: string;
  name: string;
  room: string;
  status: string;
  statusText: string;
  statusColor: string;
}

interface Stat {
  icon: string;
  value: string;
  label: string;
  gradientClass: string;
}

const features: Feature[] = [
  {
    icon: '📸',
    title: 'Biometric Face Registration',
    desc: 'Verify identity quickly using AI facial recognition.',
    hoverBorder: 'border-gold',
    iconBg: 'bg-gold/15',
  },
  {
    icon: '📅',
    title: 'Schedules & Exams',
    desc: 'Synchronize academic schedule and exams automatically.',
    hoverBorder: 'border-cyan',
    iconBg: 'bg-cyan/15',
  },
  {
    icon: '📊',
    title: 'Attendance History Tracking',
    desc: 'View detailed attendance logs for each enrolled subject.',
    hoverBorder: 'border-green',
    iconBg: 'bg-green/15',
  },
  {
    icon: '🔔',
    title: 'Violation Notifications',
    desc: 'Instant warnings when exam regulations are breached.',
    hoverBorder: 'border-red',
    iconBg: 'bg-red/15',
  },
];

const scheduleItems: ScheduleItem[] = [
  { time: '07:30', name: 'Web Programming', room: 'A2-301', status: 'done', statusText: '✓ Done', statusColor: 'text-green' },
  { time: '09:45', name: 'Databases', room: 'B1-205', status: 'next', statusText: 'Next', statusColor: 'text-gold' },
  { time: '13:30', name: 'Discrete Math', room: 'C3-102', status: 'later', statusText: 'Afternoon', statusColor: 'text-muted' },
];

const stats: Stat[] = [
  { icon: '📱', value: '50K+', label: 'App Downloads', gradientClass: 'text-gradient-gold-green' },
  { icon: '⚡', value: '< 3s', label: 'Recognition Time', gradientClass: 'text-gradient-blue-cyan' },
  { icon: '🎯', value: '99.3%', label: 'AI Accuracy', gradientClass: 'text-gradient-cyan-green' },
  { icon: '⭐', value: '4.8/5', label: 'App Rating', gradientClass: 'text-gradient-gold-red' },
];

export default function StudentSection(): React.ReactElement {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <section id="student" className="relative bg-navy-mid py-24 px-6 overflow-hidden">
      {/* Glow orb */}
      <div
        className="absolute w-[320px] h-[320px] rounded-full blur-[80px] opacity-25 animate-pulse-glow"
        style={{ background: 'radial-gradient(circle, #3B82F6 0%, #06B6D4 50%, transparent 70%)' }}
      />

      <div className="max-w-[1200px] mx-auto">
        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center feature-grid-responsive mb-20">
          {/* LEFT — Phone Mockup */}
          <div className="relative flex justify-center items-center">
            {/* Phone frame */}
            <div className="relative w-[258px] bg-navy-card border border-blue-bright/30 rounded-[36px] p-3 animate-float shadow-[0_0_60px_rgba(59,130,246,0.12)]">
              {/* Status bar */}
              <div className="flex items-center justify-between px-4 pt-1 pb-2 text-[10px] text-muted">
                <span className="font-semibold">09:41</span>
                <div className="w-[80px] h-[22px] bg-navy rounded-full mx-auto" />
                <span>🔋</span>
              </div>

              {/* App header — blue-cyan gradient */}
              <div className="rounded-t-[16px] p-3 bg-gradient-to-r from-blue-bright to-cyan">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-syne font-bold text-white text-xs tracking-wide">EduGuard</span>
                  <span className="text-white text-sm">🔔</span>
                </div>
                <p className="text-white font-bold text-sm">Hello, Minh! 👋</p>
                <p className="text-white/60 text-[10px]">ID: 21110042 · IT K21</p>
              </div>

              {/* Attendance card */}
              <div className="bg-green/15 border border-green/30 rounded-xl mx-2 mt-2 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green text-[10px] font-bold">Today</p>
                    <p className="text-white-soft text-xs font-semibold">2/3 checked-in today</p>
                  </div>
                  <span className="text-green text-lg">✅</span>
                </div>
              </div>

              {/* Attendance ring */}
              <div className="p-4 flex flex-col items-center">
                <div className="relative w-[80px] h-[80px] mb-1">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <defs>
                      <linearGradient id="ringGradStudent2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="45" fill="none"
                      stroke="url(#ringGradStudent2)" strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray="283"
                      strokeDashoffset="42"
                      className="animate-ring-fill"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-syne font-extrabold text-base text-white-soft">85%</span>
                    <span className="text-[7px] text-muted">Attendance</span>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-navy-card p-3 border-t border-border">
                <p className="text-[10px] font-syne font-bold text-muted mb-2 uppercase tracking-wider">Today's Schedule</p>
                <div className="flex flex-col gap-1.5">
                  {scheduleItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-navy rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted font-mono">{item.time}</span>
                        <span className="text-[10px] text-white-soft font-medium">{item.name}</span>
                      </div>
                      <span className={`text-[9px] font-semibold ${item.statusColor}`}>
                        {item.statusText}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-navy p-3 grid grid-cols-2 gap-2">
                <button className="bg-blue-bright/15 border border-blue-bright/30 rounded-xl py-2 text-[9px] text-blue-bright font-bold">
                  Face Register
                </button>
                <button className="bg-cyan/15 border border-cyan/30 rounded-xl py-2 text-[9px] text-cyan font-bold">
                  History
                </button>
              </div>

              {/* Bottom nav */}
              <div className="flex justify-around py-2 border-t border-border bg-navy-card rounded-b-[20px] text-[9px] text-muted">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm text-blue-bright">🏠</span>
                  <span className="text-blue-bright font-bold">Home</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">📅</span>
                  <span>Calendar</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">📝</span>
                  <span>Exams</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm">👤</span>
                  <span>Profile</span>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-4 top-[25%] bg-navy-card border border-green/30 rounded-xl px-3 py-2 text-[10px] text-green font-semibold shadow-lg animate-float-badge whitespace-nowrap">
              ✅ Attendance Success
            </div>
            <div className="absolute -right-4 bottom-[25%] bg-navy-card border border-cyan/30 rounded-xl px-3 py-2 text-[10px] text-cyan font-semibold shadow-lg animate-float-badge-delay whitespace-nowrap">
              📅 Exams Updated
            </div>
          </div>

          {/* RIGHT — Content */}
          <div>
            {/* Section label */}
            <div className="flex items-center gap-3 mb-6 section-label-line">
              <span className="text-gold font-dm text-sm font-semibold uppercase tracking-[0.15em]">
                For Students
              </span>
            </div>

            {/* Title */}
            <h2 className="font-syne text-[2.5rem] lg:text-[3rem] font-extrabold leading-[1.15] mb-5">
              Smarter learning{' '}
              <span className="text-gradient-blue-cyan">experience</span>
            </h2>

            {/* Description */}
            <p className="text-muted text-lg leading-relaxed mb-10 max-w-[500px]">
              The app helps students actively track study schedules, record attendance using facial biometrics, and receive important notifications right on their phones.
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

            {/* Download buttons */}
            <div className="flex items-center gap-4 flex-wrap">
              <a
                href="#"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-syne font-bold text-sm text-navy
                  bg-gradient-to-r from-gold to-green shadow-[0_0_24px_rgba(245,158,11,0.25)]
                  hover:shadow-[0_0_32px_rgba(245,158,11,0.4)] hover:scale-105 transition-all duration-300"
              >
                🤖 Download Android App
              </a>
              <span className="text-muted text-sm font-dm">iOS coming Q3 2025</span>
            </div>
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 stats-responsive">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-navy-card border border-border rounded-2xl p-6 text-center hover:border-blue-bright/30 transition-colors duration-300"
            >
              <span className="text-2xl mb-2 block">{stat.icon}</span>
              <p className={`font-syne font-extrabold text-2xl mb-1 ${stat.gradientClass}`}>
                {stat.value}
              </p>
              <p className="text-muted text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
