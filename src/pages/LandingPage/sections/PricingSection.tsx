import React, { useState } from 'react';

interface Feature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  featured: boolean;
  tag?: string;
  buttonText: string;
  buttonStyle: 'primary' | 'ghost' | string;
  features: Feature[];
}

const pricingData: Plan[] = [
  {
    name: 'Starter',
    price: '$199',
    period: '/ month',
    featured: false,
    buttonText: 'Contact Us',
    buttonStyle: 'ghost',
    features: [
      { text: 'Up to 500 students', included: true },
      { text: 'Smart Attendance', included: true },
      { text: '50 exam sessions/month', included: true },
      { text: 'Basic reports', included: true },
      { text: 'LMS integration API', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    name: 'Professional',
    price: '$599',
    period: '/ month',
    featured: true,
    tag: 'Most Popular',
    buttonText: 'Contact Us',
    buttonStyle: 'primary',
    features: [
      { text: 'Up to 5,000 students', included: true },
      { text: 'Smart Attendance + Proctoring', included: true },
      { text: 'Unlimited exam sessions', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'LMS integration API', included: true },
      { text: '24/7 support', included: true },
    ],
  },
  {
    name: 'Enterprise',
    price: 'Contact',
    period: '',
    featured: false,
    buttonText: 'Contact Us',
    buttonStyle: 'ghost',
    features: [
      { text: 'Unlimited students', included: true },
      { text: 'All features included', included: true },
      { text: 'On-premise deployment', included: true },
      { text: 'Custom SSO', included: true },
      { text: '99.9% SLA guaranteed', included: true },
      { text: 'Dedicated support team', included: true },
    ],
  },
];

export default function PricingSection(): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number>(1);

  return (
    <section id="pricing" className="bg-navy py-24 px-6 relative z-10">
      <div className="max-w-[1100px] mx-auto">
        {/* Intro */}
        <div className="text-center mb-16">
          <span className="section-label-line text-cyan uppercase tracking-[0.15em] text-xs font-semibold inline-flex items-center gap-2 mb-4">
            Pricing
          </span>
          <h2 className="font-syne text-[2.4rem] font-extrabold leading-tight">
            Flexible for{' '}
            <span className="text-gradient-blue-cyan">any scale</span>
          </h2>
        </div>

        {/* Pricing Grid */}
        <div
          className="reveal pricing-responsive grid gap-6"
          style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
        >
          {pricingData.map((plan, index) => {
            const isActive = hoveredIndex === index;
            return (
              <div
                key={index}
                className={`relative bg-navy-card rounded-[20px] p-8 transition-all duration-300 hover:-translate-y-[5px] overflow-hidden ${
                  isActive
                    ? 'border border-cyan shadow-[0_0_40px_rgba(6,182,212,0.22)]'
                    : 'border border-border'
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(1)}
              >
                {/* Gradient overlay for active */}
                {isActive && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(6,182,212,0.06))',
                    }}
                  />
                )}

                {/* Popular tag */}
                {plan.tag && (
                  <span className="relative z-10 inline-block bg-cyan text-navy text-xs font-bold px-3 py-1 rounded-full mb-5">
                    {plan.tag}
                  </span>
                )}

                {/* Plan name */}
                <h3 className="relative z-10 font-syne font-bold text-[1.2rem] text-white-soft mb-2">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="relative z-10 mb-6">
                  <span className="text-[2.4rem] font-syne font-extrabold text-white-soft">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted text-sm">{plan.period}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="relative z-10 space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <span className="text-green font-bold">✓</span>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                      <span className={feature.included ? 'text-muted' : 'text-muted opacity-50'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                {isActive ? (
                  <button className="relative z-10 w-full py-3 rounded-[12px] font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-blue to-cyan text-white-soft hover:shadow-[0_0_25px_rgba(37,99,235,0.35)] cursor-pointer">
                    {plan.buttonText}
                  </button>
                ) : (
                  <button className="relative z-10 w-full py-3 rounded-[12px] font-semibold text-sm transition-all duration-300 border border-border text-muted hover:border-blue hover:text-white-soft cursor-pointer bg-transparent">
                    {plan.buttonText}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
