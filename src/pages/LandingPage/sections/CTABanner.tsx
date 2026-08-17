import React from 'react';

export default function CTABanner({ onContactClick }: { onContactClick: () => void }): React.ReactElement {
  return (
    <section className="relative py-20 px-6">
      <div
        className="reveal max-w-[1000px] mx-auto relative bg-navy-card border border-border rounded-[24px] p-10 md:p-16 text-center overflow-hidden"
        style={{
          backgroundImage: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(6,182,212,0.06) 100%)',
        }}
      >
        {/* Glow orb top-right */}
        <div
          className="absolute -top-16 -right-16 w-[250px] h-[250px] rounded-full blur-[80px] opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
        />

        {/* Label */}
        <div className="flex items-center justify-center gap-3 mb-6 section-label-line">
          <span className="text-cyan font-dm text-sm font-semibold uppercase tracking-[0.15em]">
            Get Started Today
          </span>
        </div>

        {/* Title */}
        <h2 className="font-syne text-[2.2rem] md:text-[3rem] font-extrabold leading-[1.15] mb-10">
          Ready to transform{' '}
          <span className="text-gradient-blue-cyan">your organization?</span>
        </h2>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={onContactClick}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-syne font-bold text-sm text-white-soft
              bg-gradient-to-r from-blue to-cyan shadow-[0_0_24px_rgba(37,99,235,0.3)]
              hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] hover:scale-105 transition-all duration-300 border-none cursor-pointer"
          >
            📩 Contact Us
          </button>
        </div>
      </div>
    </section>
  );
}
