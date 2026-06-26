import React from 'react';

interface HeroStat {
  num: string;
  label: string;
}

interface CamCell {
  initials: string;
  gradient: string;
  type: 'active' | 'warn';
  status: string;
  scan: boolean;
  scanDelay: string | null;
}

const heroStats: HeroStat[] = [
  { num: '300+', label: 'Organizations' },
  { num: '50K+', label: 'Students' },
  { num: '2M+', label: 'Attendance Checks' },
  { num: '99.9%', label: 'Uptime' },
];

const camCells: CamCell[] = [
  { initials: 'NT', gradient: 'linear-gradient(135deg, #3B82F6, #06B6D4)', type: 'active', status: '✓ Normal', scan: true, scanDelay: null },
  { initials: 'LH', gradient: 'linear-gradient(135deg, #EF4444, #F59E0B)', type: 'warn', status: '⚠ Looking away', scan: false, scanDelay: null },
  { initials: 'TM', gradient: 'linear-gradient(135deg, #10B981, #3B82F6)', type: 'active', status: '✓ Normal', scan: true, scanDelay: '0.5s' },
  { initials: 'VD', gradient: 'linear-gradient(135deg, #8B5CF6, #EC4899)', type: 'active', status: '✓ Normal', scan: true, scanDelay: '1s' },
  { initials: 'PL', gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)', type: 'active', status: '✓ Normal', scan: false, scanDelay: null },
  { initials: 'BK', gradient: 'linear-gradient(135deg, #06B6D4, #10B981)', type: 'warn', status: '⚠ 2 Faces', scan: false, scanDelay: null },
];

export default function HeroSection(): React.ReactElement {
  return (
    <section className="hero-grid-bg hero-responsive min-h-screen grid grid-cols-2 items-center gap-16 pt-[100px] pb-[80px] px-[5vw] relative overflow-hidden">
      {/* Glow Orb */}
      <div
        className="animate-pulse-glow absolute w-[700px] h-[700px] rounded-full z-0"
        style={{
          background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)',
          top: '-120px',
          right: '-100px',
        }}
      />

      {/* ── LEFT SIDE ── */}
      <div className="relative z-2">
        {/* Badge */}
        <div className="animate-fade-slide-in inline-flex items-center gap-2 bg-[rgba(6,182,212,0.12)] border border-[rgba(6,182,212,0.35)] text-cyan py-[0.35rem] px-4 rounded-full text-[0.8rem] font-medium mb-6">
          <span className="animate-blink w-[7px] h-[7px] rounded-full bg-cyan" />
          Next-Gen AI Education Platform
        </div>

        {/* Title */}
        <h1 className="animate-fade-slide-in-1 font-syne font-extrabold leading-[1.1] tracking-[-0.03em] mb-[1.4rem]" style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)' }}>
          Automated Attendance.<br />
          Smart <span className="text-gradient-blue-cyan">Proctoring.</span><br />
          All-in-One.
        </h1>

        {/* Description */}
        <p className="animate-fade-slide-in-2 text-muted text-[1.05rem] max-w-[500px] mb-[2.2rem]">
          EduGuard leverages state-of-the-art AI facial recognition & gaze tracking to automate classroom attendance in seconds and strictly monitor online exams — completely eliminating manual proctoring.
        </p>

        {/* Action Buttons */}
        <div className="animate-fade-slide-in-3 flex gap-4 flex-wrap">
          <button className="bg-linear-to-br from-blue to-cyan border-none text-white py-[0.8rem] px-8 rounded-[10px] text-[1rem] cursor-pointer font-dm font-semibold shadow-[0_0_28px_rgba(37,99,235,0.55)] transition-all duration-200 hover:shadow-[0_0_44px_rgba(6,182,212,0.6)] hover:-translate-y-[2px]">
            📩 Contact Us
          </button>
        </div>

        {/* Stats Row */}
        <div className="animate-fade-slide-in-4 hero-stats-responsive flex gap-10 mt-12">
          {heroStats.map((stat) => (
            <div key={stat.label}>
              <div className="text-gradient-white-cyan font-syne font-extrabold text-[1.7rem]">
                {stat.num}
              </div>
              <div className="text-muted text-[0.82rem]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT SIDE (Mockup) ── */}
      <div className="hero-right-responsive relative z-2 animate-float-up">
        <div className="relative">
          {/* Mockup Card */}
          <div className="animate-float bg-navy-card border border-border rounded-[18px] p-6 backdrop-blur-[12px] shadow-[0_0_60px_rgba(37,99,235,0.15),0_40px_80px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-[1.2rem]">
              <div>
                <div className="font-syne font-bold text-[1rem]">Live Proctoring</div>
                <div className="text-muted text-[0.78rem]">Math Midterm – CS101</div>
              </div>
              <div className="bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.4)] text-green rounded-full py-[0.2rem] px-[0.7rem] text-[0.75rem] font-semibold flex items-center gap-[0.4rem]">
                <span className="animate-blink w-[6px] h-[6px] bg-green rounded-full inline-block" />
                LIVE
              </div>
            </div>

            {/* Camera Grid */}
            <div className="grid grid-cols-3 gap-[0.6rem] mb-[1.2rem]">
              {camCells.map((cell) => (
                <div
                  key={cell.initials}
                  className={`aspect-[4/3] bg-navy-mid rounded-[10px] border relative overflow-hidden flex items-center justify-center ${
                    cell.type === 'active' ? 'border-green' : 'border-red'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full font-syne font-bold text-[0.85rem] grid place-items-center text-white"
                    style={{ background: cell.gradient }}
                  >
                    {cell.initials}
                  </div>
                  {cell.scan && (
                    <div
                      className="animate-scan absolute top-0 left-0 right-0 h-[2px] bg-cyan opacity-70"
                      style={cell.scanDelay ? { animationDelay: cell.scanDelay } : undefined}
                    />
                  )}
                  <div
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[0.6rem] font-semibold rounded-full py-[1px] px-[6px] whitespace-nowrap ${
                      cell.type === 'active'
                        ? 'bg-[rgba(16,185,129,0.25)] text-green'
                        : 'bg-[rgba(239,68,68,0.25)] text-red'
                    }`}
                  >
                    {cell.status}
                  </div>
                </div>
              ))}
            </div>

            {/* Alert Row */}
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-[8px] py-[0.6rem] px-[0.8rem] flex items-center gap-[0.7rem] text-[0.8rem] mb-[0.6rem]">
              <span className="text-[1rem]">🚨</span>
              <span className="text-[#FCA5A5] font-medium">LH looking away from screen continuously &gt;5s</span>
              <span className="ml-auto text-muted text-[0.72rem]">09:42</span>
            </div>

            {/* Attendance Row */}
            <div className="bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)] rounded-[8px] py-[0.6rem] px-[0.8rem] flex items-center gap-[0.7rem] text-[0.8rem]">
              <div>
                <div className="font-syne font-extrabold text-[1.1rem] text-green">38/40</div>
                <div className="text-muted text-[0.78rem]">Students present</div>
              </div>
              <div className="ml-auto flex items-center gap-[0.4rem] text-green text-[0.82rem] font-semibold">
                <span>●</span> 95% Present
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
