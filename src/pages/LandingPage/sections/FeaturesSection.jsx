const featuresData = [
  {
    icon: '🎯',
    name: 'Smart Attendance',
    description: 'Automated attendance via AI facial recognition, performing batch scanning in seconds.',
    iconBg: 'rgba(37,99,235,0.18)',
  },
  {
    icon: '👁️',
    name: 'Live Proctoring',
    description: 'Real-time exam proctoring via webcam, detecting suspicious behaviors via AI and alerting instantly.',
    iconBg: 'rgba(239,68,68,0.18)',
  },
  {
    icon: '📊',
    name: 'Analytics & Reports',
    description: 'Intuitive dashboards to track attendance rates, analyze violation stats, and export detailed reports.',
    iconBg: 'rgba(16,185,129,0.18)',
  },
  {
    icon: '💳',
    name: 'Wallet & Billing',
    description: 'Flexible SaaS wallet system, automatically deducting credits per AI check for full cost transparency.',
    iconBg: 'rgba(245,158,11,0.18)',
  },
  {
    icon: '📱',
    name: 'Mobile App',
    description: 'Android application for students — biometric face registration, schedules, and exam entry on the go.',
    iconBg: 'rgba(139,92,246,0.18)',
  },
  {
    icon: '🔐',
    name: 'SSO & Security',
    description: 'Secure authentication via Google / Microsoft SSO, granular permissions, and end-to-end encryption.',
    iconBg: 'rgba(6,182,212,0.18)',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-navy-mid py-24 px-6 relative z-10">
      <div className="max-w-[1200px] mx-auto">
        {/* Intro */}
        <div className="text-center mb-16">
          <span className="section-label-line text-cyan uppercase tracking-[0.15em] text-xs font-semibold inline-flex items-center gap-2 mb-4">
            Key Features
          </span>
          <h2 className="font-syne text-[2.4rem] font-extrabold leading-tight mb-4">
            All in <span className="text-gradient-blue-cyan">One Platform</span>
          </h2>
          <p className="text-muted max-w-[600px] mx-auto text-[1.05rem]">
            EduGuard integrates AI attendance, exam proctoring, user management, and SaaS billing — all under a single beautiful dashboard.
          </p>
        </div>

        {/* Cards Grid */}
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
        >
          {featuresData.map((feature, index) => (
            <div
              key={index}
              className="reveal feat-card-bar group relative bg-navy-card border border-border rounded-[16px] p-8 transition-all duration-300 hover:border-cyan hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] overflow-hidden"
            >
              {/* Icon */}
              <div
                className="w-[50px] h-[50px] rounded-[12px] flex items-center justify-center text-2xl mb-5"
                style={{ background: feature.iconBg }}
              >
                {feature.icon}
              </div>

              {/* Name */}
              <h3 className="font-syne font-bold text-[1.1rem] text-white-soft mb-2">
                {feature.name}
              </h3>

              {/* Description */}
              <p className="text-muted text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
