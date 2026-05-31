import React from 'react';

interface Stat {
  num: string;
  label: string;
}

const stats: Stat[] = [
  { num: '300+', label: 'Partner Organizations' },
  { num: '50K+', label: 'Registered Students' },
  { num: '2M+', label: 'Attendance Checks' },
  { num: '99.9%', label: 'System Uptime' },
];

export default function StatsBanner(): React.ReactElement {
  return (
    <div
      id="about"
      className="stats-responsive reveal bg-linear-to-br from-blue to-[rgba(6,182,212,0.9)] rounded-[24px] mx-[5vw] py-[3.5rem] px-[4rem] grid grid-cols-4 gap-8 text-center shadow-[0_0_80px_rgba(37,99,235,0.4)]"
    >
      {stats.map((stat) => (
        <div key={stat.label}>
          <span className="font-syne font-extrabold text-[2.2rem] block">
            {stat.num}
          </span>
          <span className="text-[0.85rem] opacity-85">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
