import { useState } from 'react';

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

const features: Feature[] = [
  {
    icon: '📸',
    title: 'Biometric Face Registration',
    desc: 'Capture & verify your face directly in the app in just 30 seconds.',
    hoverBorder: 'border-gold',
    iconBg: 'bg-gold/15',
  },
  {
    icon: '📅',
    title: 'Schedules & Notifications',
    desc: 'Sync your study schedule and receive reminders before classes.',
    hoverBorder: 'border-cyan',
    iconBg: 'bg-cyan/15',
  },
  {
    icon: '📊',
    title: 'Track Attendance Rate',
    desc: 'Personalized dashboard displaying real-time attendance percentage.',
    hoverBorder: 'border-green',
    iconBg: 'bg-green/15',
  },
  {
    icon: '🔔',
    title: 'Exam Violation Alerts',
    desc: 'Instant notifications if AI detects suspicious behavior during exams.',
    hoverBorder: 'border-red',
    iconBg: 'bg-red/15',
  },
  {
    icon: '🔄',
    title: 'Biometric Re-registration',
    desc: 'Submit a request to re-register your face when changing appearance.',
    hoverBorder: 'border-[#8B5CF6]',
    iconBg: 'bg-[#8B5CF6]/15',
  },
];

const scheduleItems: ScheduleItem[] = [
  { time: '07:30', name: 'Web Programming', room: 'A2-301', status: 'done', statusText: '✓ Present', statusColor: 'text-green' },
  { time: '09:45', name: 'Databases', room: 'B1-205', status: 'upcoming', statusText: 'Upcoming', statusColor: 'text-gold' },
  { time: '13:30', name: 'Math Midterm', room: 'Hall A', status: 'exam', statusText: '🔴 Exam', statusColor: 'text-red' },
];

export default function StudentFeatureSection() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <section id="student-feature" className="relative bg-navy py-24 px-6 overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* LEFT — Content */}
        <div>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-6 section-label-line">
            <span className="text-gold font-dm text-sm font-semibold uppercase tracking-[0.15em]">
              For Students
            </span>
          </div>

          {/* Title */}
          <h2 className="font-syne text-[2.5rem] lg:text-[3rem] font-extrabold leading-[1.15] mb-5">
            Active learning,
            <br />
            <span className="text-gradient-gold-green">instant attendance</span>
          </h2>

          {/* Description */}
          <p className="text-muted text-lg leading-relaxed mb-10 max-w-[500px]">
            The mobile application helps students actively manage their learning, record face attendance in seconds, and track exam schedules anytime, anywhere.
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

        </div>

        {/* RIGHT — Phone mockup */}
        <div className="relative flex justify-center items-center">
          {/* Glow orb */}
          <div
            className="absolute w-[340px] h-[340px] rounded-full blur-[80px] opacity-30 animate-pulse-glow"
            style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)' }}
          />

          {/* Phone frame */}
          <div className="relative w-[258px] bg-navy-card border border-gold/40 rounded-[36px] p-3 animate-float shadow-[0_0_60px_rgba(245,158,11,0.12)]">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 pt-1 pb-2 text-[10px] text-muted">
              <span className="font-semibold">09:41</span>
              <div className="w-[80px] h-[22px] bg-navy rounded-full mx-auto" />
              <span>🔋</span>
            </div>

            {/* App header */}
            <div className="rounded-t-[16px] p-3 bg-gradient-to-r from-gold to-green">
              <div className="flex items-center justify-between mb-2">
                <span className="font-syne font-bold text-navy text-xs tracking-wide">EduGuard</span>
                <span className="text-navy text-sm">🔔</span>
              </div>
              <p className="text-navy font-bold text-sm">Nguyen Van An 👋</p>
              <p className="text-navy/60 text-[10px]">ID: 21110001 · IT K21</p>
            </div>

            {/* Attendance ring */}
            <div className="bg-navy p-4 flex flex-col items-center">
              <div className="relative w-[90px] h-[90px] mb-2">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <defs>
                    <linearGradient id="ringGradStudent" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="url(#ringGradStudent)" strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset="42"
                    className="animate-ring-fill"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-syne font-extrabold text-lg text-white-soft">85%</span>
                  <span className="text-[8px] text-muted">Attendance</span>
                </div>
              </div>
              <p className="text-gold text-[10px] font-semibold">⚠ Maintain &gt; 80%</p>
            </div>

            {/* Today schedule */}
            <div className="bg-navy-card p-3 border-t border-border">
              <p className="text-[10px] font-syne font-bold text-muted mb-2 uppercase tracking-wider">Today</p>
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
              <button className="bg-gold/15 border border-gold/30 rounded-xl py-2 text-[9px] text-gold font-bold">
                Face Register
              </button>
              <button className="bg-cyan/15 border border-cyan/30 rounded-xl py-2 text-[9px] text-cyan font-bold">
                History
              </button>
            </div>

            {/* Bottom nav */}
            <div className="flex justify-around py-2 border-t border-border bg-navy-card rounded-b-[20px] text-[9px] text-muted">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm text-gold">🏠</span>
                <span className="text-gold font-bold">Home</span>
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

        </div>
      </div>
    </section>
  );
}
