import { useState } from 'react';

const stepsData = [
  {
    number: 1,
    title: 'Students register their face',
    description: 'Students use the app to capture and register facial data into the AI system.',
  },
  {
    number: 2,
    title: 'Instructor starts attendance session',
    description: 'Instructor creates an attendance session on the web, and the AI system is ready to recognize.',
  },
  {
    number: 3,
    title: 'Instant results',
    description: 'AI processes and returns attendance results in real-time, displayed directly on the dashboard.',
  },
  {
    number: 4,
    title: 'Exam proctoring & violation reports',
    description: 'The system monitors exam sessions, detects cheating, and generates detailed reports.',
  },
];

const activitiesData = [
  {
    type: 'success',
    icon: '✓',
    name: 'Nguyen Thanh',
    action: 'Attendance recorded successfully',
    time: '09:01',
    color: 'text-green',
    dotColor: 'bg-green',
  },
  {
    type: 'warning',
    icon: '⚠',
    name: 'Le Hung',
    action: 'Continuously looking away',
    time: '09:12',
    color: 'text-red',
    dotColor: 'bg-red',
  },
  {
    type: 'warning',
    icon: '⚠',
    name: 'Bui Kim',
    action: '2 faces detected',
    time: '09:28',
    color: 'text-gold',
    dotColor: 'bg-gold',
  },
  {
    type: 'success',
    icon: '✓',
    name: 'Tran Minh',
    action: 'Face verification OK',
    time: '09:33',
    color: 'text-green',
    dotColor: 'bg-green',
  },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how" className="bg-navy py-24 px-6 relative z-10">
      <div className="max-w-[1200px] mx-auto">
        {/* Intro */}
        <div className="text-center mb-16">
          <span className="section-label-line text-cyan uppercase tracking-[0.15em] text-xs font-semibold inline-flex items-center gap-2 mb-4">
            Process
          </span>
          <h2 className="font-syne text-[2.4rem] font-extrabold leading-tight">
            How EduGuard{' '}
            <span className="text-gradient-blue-cyan">works</span>
          </h2>
        </div>

        {/* 2-column grid */}
        <div
          className="hiw-responsive grid items-start"
          style={{ gridTemplateColumns: '1fr 1fr', gap: '5rem' }}
        >
          {/* LEFT — Steps */}
          <div className="space-y-3">
            {stepsData.map((step, index) => (
              <div
                key={index}
                className={`reveal group flex items-start gap-4 p-5 rounded-[14px] cursor-pointer transition-all duration-300 ${
                  activeStep === index
                    ? 'bg-[rgba(37,99,235,0.1)] border border-blue'
                    : 'border border-transparent hover:bg-[rgba(37,99,235,0.05)]'
                }`}
                onClick={() => setActiveStep(index)}
              >
                {/* Number circle */}
                <div
                  className="w-[38px] h-[38px] min-w-[38px] rounded-full flex items-center justify-center text-sm font-bold text-white-soft"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                  }}
                >
                  {step.number}
                </div>

                {/* Text */}
                <div>
                  <h4 className="font-syne font-bold text-[1rem] text-white-soft mb-1">
                    {step.title}
                  </h4>
                  <p className="text-muted text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — Visual card */}
          <div className="reveal bg-navy-card border border-border rounded-[20px] p-8 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
            {/* Progress ring */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                  <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  {/* Background ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="45"
                    fill="none"
                    stroke="rgba(59,130,246,0.15)"
                    strokeWidth="10"
                  />
                  {/* Fill ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="45"
                    fill="none"
                    stroke="url(#ringGrad)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset="57"
                    className="animate-ring-fill"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'rotate(0deg)' }}>
                  <span className="text-[2rem] font-syne font-extrabold text-white-soft leading-none">
                    80%
                  </span>
                  <span className="text-muted text-xs mt-1">Present</span>
                </div>
              </div>
            </div>

            {/* Metric boxes */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-[12px] p-3 text-center">
                <div className="text-green text-xl font-bold font-syne">38</div>
                <div className="text-muted text-xs">Present</div>
              </div>
              <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] p-3 text-center">
                <div className="text-red text-xl font-bold font-syne">2</div>
                <div className="text-muted text-xs">Absent</div>
              </div>
              <div className="bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] rounded-[12px] p-3 text-center">
                <div className="text-gold text-xl font-bold font-syne">3</div>
                <div className="text-muted text-xs">Violations</div>
              </div>
            </div>

            {/* Activity log */}
            <div>
              <h4 className="text-xs text-muted uppercase tracking-wider mb-3 font-semibold">
                Recent Activity
              </h4>
              <div className="space-y-3">
                {activitiesData.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-sm"
                  >
                    {/* Indicator dot */}
                    <div
                      className={`w-2 h-2 rounded-full ${activity.dotColor} shrink-0`}
                    />
                    {/* Icon */}
                    <span className={`${activity.color} shrink-0`}>
                      {activity.icon}
                    </span>
                    {/* Text */}
                    <span className="text-white-soft font-medium">
                      {activity.name}
                    </span>
                    <span className="text-muted">–</span>
                    <span className={`${activity.color} flex-1`}>
                      {activity.action}
                    </span>
                    {/* Time */}
                    <span className="text-muted text-xs shrink-0">
                      {activity.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
