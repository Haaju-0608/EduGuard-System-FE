import React from 'react';

interface RoleData {
  icon: string;
  title: string;
  description: string;
  iconBg: string;
  permissions: string[];
}

const rolesData: RoleData[] = [
  {
    icon: '👑',
    title: 'Super Admin',
    description: 'Manage the entire platform',
    iconBg: 'rgba(139,92,246,0.18)',
    permissions: [
      'Manage partner organizations',
      'Configure AI pricing',
      'Revenue statistics',
      'System-wide reports',
    ],
  },
  {
    icon: '🏫',
    title: 'School Admin',
    description: 'Operate daily activities',
    iconBg: 'rgba(37,99,235,0.18)',
    permissions: [
      'Manage instructors & students',
      'Create classes & assign roles',
      'Approve biometric re-registration',
      'Monitor attendance/exam sessions',
    ],
  },
  {
    icon: '👨‍🏫',
    title: 'Lecturer',
    description: 'Interact via web dashboard',
    iconBg: 'rgba(16,185,129,0.18)',
    permissions: [
      'Start AI attendance sessions',
      'Create & manage exams',
      'Real-time proctoring dashboard',
      'Review violations & disqualify students',
    ],
  },
  {
    icon: '🎓',
    title: 'Student',
    description: 'Experience via Android app',
    iconBg: 'rgba(245,158,11,0.18)',
    permissions: [
      'Register facial data',
      'View class & exam schedules',
      'Join AI-powered online exams',
      'View attendance history',
    ],
  },
];

export default function RolesSection(): React.ReactElement {
  return (
    <section id="roles" className="bg-navy-mid py-24 px-6 relative z-10">
      <div className="max-w-[1200px] mx-auto">
        {/* Intro */}
        <div className="text-center mb-16">
          <span className="section-label-line text-cyan uppercase tracking-[0.15em] text-xs font-semibold inline-flex items-center gap-2 mb-4">
            Access Control
          </span>
          <h2 className="font-syne text-[2.4rem] font-extrabold leading-tight">
            4 Roles,{' '}
            <span className="text-gradient-blue-cyan">1 Ecosystem</span>
          </h2>
        </div>

        {/* Roles Grid */}
        <div
          className="roles-responsive grid gap-6"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          {rolesData.map((role, index) => (
            <div
              key={index}
              className="reveal group bg-navy-card border border-border rounded-[16px] p-8 transition-all duration-300 hover:-translate-y-[5px] hover:border-blue hover:shadow-[0_0_30px_rgba(37,99,235,0.15)]"
            >
              {/* Icon */}
              <div
                className="w-[50px] h-[50px] rounded-[12px] flex items-center justify-center text-2xl mb-5"
                style={{ background: role.iconBg }}
              >
                {role.icon}
              </div>

              {/* Title */}
              <h3 className="font-syne font-bold text-[1.1rem] text-white-soft mb-1">
                {role.title}
              </h3>

              {/* Description */}
              <p className="text-muted text-sm mb-5">{role.description}</p>

              {/* Permissions */}
              <ul className="space-y-2">
                {role.permissions.map((perm, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-cyan font-bold mt-px">✓</span>
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
