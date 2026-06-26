import React from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowRight, FiClock, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchLecturers,
  fetchSchoolAdminBiometricRequests,
  fetchSchoolAdminClasses,
  fetchSchoolAdminStudents,
  fetchWallet,
} from '../../../services/schoolAdminApi';

interface KpiCardData {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  colorClass: string;
  bgGlow: string;
  borderHover: string;
  change: string | null;
  changeColor?: string;
  sparkPath: string;
  sparkStroke: string;
  sparkColor: string;
}

const SPARK = {
  blue: {
    sparkPath: 'M0,40 C20,38 30,30 50,32 C70,34 80,20 100,22 C120,24 140,15 160,18 C180,21 200,10 220,12 L220,60 L0,60 Z',
    sparkStroke: 'M0,40 C20,38 30,30 50,32 C70,34 80,20 100,22 C120,24 140,15 160,18 C180,21 200,10 220,12',
    sparkColor: 'var(--color-blue-bright)',
  },
  cyan: {
    sparkPath: 'M0,32 C30,28 50,35 80,30 C110,25 130,32 160,22 C185,15 200,20 220,16 L220,60 L0,60 Z',
    sparkStroke: 'M0,32 C30,28 50,35 80,30 C110,25 130,32 160,22 C185,15 200,20 220,16',
    sparkColor: 'var(--color-cyan)',
  },
  green: {
    sparkPath: 'M0,35 C25,30 40,25 65,28 C90,31 100,18 130,20 C155,22 180,14 220,10 L220,60 L0,60 Z',
    sparkStroke: 'M0,35 C25,30 40,25 65,28 C90,31 100,18 130,20 C155,22 180,14 220,10',
    sparkColor: 'var(--color-green)',
  },
  gold: {
    sparkPath: 'M0,30 C30,25 55,35 80,28 C105,21 125,30 155,20 C175,14 200,18 220,14 L220,60 L0,60 Z',
    sparkStroke: 'M0,30 C30,25 55,35 80,28 C105,21 125,30 155,20 C175,14 200,18 220,14',
    sparkColor: 'var(--color-gold)',
  },
};

function KpiCard({ card, index }: { card: KpiCardData; index: number }) {
  return (
    <div
      className={`relative overflow-hidden bg-navy-card border border-border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(6,182,212,0.08)] ${card.borderHover} group animate-fade-slide-in`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={`absolute inset-0 bg-linear-to-br ${card.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      <div className="relative z-1">
        <div className="flex items-start justify-between mb-4">
          <div className="text-2xl">{card.icon}</div>
          {card.change && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 ${card.changeColor ?? 'text-muted'}`}>
              {card.change}
            </span>
          )}
        </div>
        <p className={`font-syne font-extrabold text-[2rem] leading-none ${card.colorClass}`}>{card.value}</p>
        <p className="text-muted text-sm mt-1">{card.label}</p>
        {card.subtitle && <p className={`text-[11px] font-semibold mt-0.5 ${card.colorClass}`}>{card.subtitle}</p>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-15 pointer-events-none">
        <svg viewBox="0 0 220 60" className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`spark-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={card.sparkColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={card.sparkColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={card.sparkPath} fill={`url(#spark-fill-${index})`} />
          <path d={card.sparkStroke} fill="none" stroke={card.sparkColor} strokeWidth="1.5" strokeOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

function KpiSkeleton({ index }: { index: number }) {
  return (
    <div className="bg-navy-card border border-border rounded-2xl p-5 animate-pulse" style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-8 h-8 bg-white/5 rounded-xl" />
        <div className="w-20 h-5 bg-white/5 rounded-full" />
      </div>
      <div className="h-8 bg-white/5 rounded-xl w-1/2 mb-2" />
      <div className="h-3 bg-white/5 rounded w-2/3" />
    </div>
  );
}

export default function SchoolDashboardOverview() {
  const { user } = useAuth();
  const institutionId = user?.institutionId ?? '';

  const { data: studentsData, loading: loadingS } = useAsyncData(
    () => fetchSchoolAdminStudents({ page: 1, pageSize: 1 }),
    [],
  );
  const { data: lecturersData, loading: loadingL } = useAsyncData(
    () => fetchLecturers({ page: 1, pageSize: 1 }),
    [],
  );
  const { data: classesData, loading: loadingC } = useAsyncData(
    () => fetchSchoolAdminClasses({ page: 1, pageSize: 1 }),
    [],
  );
  const { data: walletData, loading: loadingW } = useAsyncData(
    () => (institutionId ? fetchWallet(institutionId) : Promise.resolve(null)),
    [institutionId],
  );
  const { data: biometricData } = useAsyncData(
    () => fetchSchoolAdminBiometricRequests({ page: 1, pageSize: 50 }),
    [],
  );

  const totalStudents = studentsData?.pagination?.totalItems ?? 0;
  const totalLecturers = lecturersData?.pagination?.totalItems ?? 0;
  const totalClasses = classesData?.pagination?.totalItems ?? 0;
  const balance = walletData?.balance ?? 0;
  const isLowBalance = balance < 10_000;
  const pendingBiometric = biometricData?.items.filter((r) => r.status === 'pending').length ?? 0;

  const kpiCards: KpiCardData[] = [
    {
      label: 'Total Students', value: loadingS ? '…' : totalStudents.toLocaleString(),
      icon: '👨‍🎓', colorClass: 'text-blue-bright', bgGlow: 'from-blue/10 to-blue-bright/5',
      borderHover: 'hover:border-blue-bright/50', change: null,
      ...SPARK.blue,
    },
    {
      label: 'Total Lecturers', value: loadingL ? '…' : String(totalLecturers),
      icon: '👨‍🏫', colorClass: 'text-cyan', bgGlow: 'from-cyan/10 to-cyan/5',
      borderHover: 'hover:border-cyan/50', change: null,
      ...SPARK.cyan,
    },
    {
      label: 'Total Classes', value: loadingC ? '…' : String(totalClasses),
      icon: '📚', colorClass: 'text-green', bgGlow: 'from-green/10 to-green/5',
      borderHover: 'hover:border-green/50', change: null,
      ...SPARK.green,
    },
    {
      label: 'Wallet Balance', value: loadingW ? '…' : balance.toLocaleString(),
      subtitle: 'AI Credits', icon: '💳', colorClass: 'text-gold',
      bgGlow: 'from-gold/10 to-gold/5', borderHover: 'hover:border-gold/50',
      change: isLowBalance && !loadingW ? 'Low balance' : null, changeColor: 'text-red',
      ...SPARK.gold,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-syne font-extrabold text-[1.6rem] text-white-soft">School Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Welcome back, <span className="text-cyan font-semibold">{user?.name ?? 'Admin'}</span>
            {user?.institutionId && (
              <span className="ml-2 text-muted/60">· Institution #{user.institutionId}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted bg-navy-card border border-border rounded-xl px-3 py-2">
          <FiClock className="text-cyan" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card, i) =>
          loadingS || loadingL || loadingC || loadingW
            ? <KpiSkeleton key={card.label} index={i} />
            : <KpiCard key={card.label} card={card} index={i} />,
        )}
      </div>

      {/* Pending Tasks + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Action Required */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FiAlertCircle className="text-gold text-base" />
            <h2 className="font-syne font-bold text-white-soft text-sm">Action Required</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                label: 'Face Re-registration Pending',
                count: pendingBiometric,
                link: '/school/biometric',
                color: 'text-gold border-gold/30 bg-gold/5',
                icon: '🔐',
                show: pendingBiometric > 0,
              },
              {
                label: 'Wallet Low Balance',
                count: balance,
                link: '/school/wallet',
                color: 'text-red border-red/30 bg-red/5',
                icon: '💳',
                show: isLowBalance && !loadingW,
              },
            ]
              .filter((t) => t.show)
              .map((task) => (
                <Link
                  key={task.label}
                  to={task.link}
                  className={`flex items-center justify-between p-3 rounded-xl border ${task.color} no-underline transition-all hover:opacity-80`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{task.icon}</span>
                    <span className="text-[13px] font-medium text-white-soft">{task.label}</span>
                  </div>
                  <FiArrowRight className="text-xs" />
                </Link>
              ))}
            {pendingBiometric === 0 && !isLowBalance && !loadingW && (
              <p className="text-muted text-sm text-center py-4">No urgent actions required.</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-xl bg-navy/60 border border-border">
              <p className="font-syne font-extrabold text-lg text-blue-bright">{loadingS ? '…' : totalStudents.toLocaleString()}</p>
              <p className="text-[10px] text-muted mt-0.5">Students</p>
            </div>
            <div className="p-2 rounded-xl bg-navy/60 border border-border">
              <p className="font-syne font-extrabold text-lg text-cyan">{loadingL ? '…' : totalLecturers}</p>
              <p className="text-[10px] text-muted mt-0.5">Lecturers</p>
            </div>
            <div className="p-2 rounded-xl bg-navy/60 border border-border">
              <p className="font-syne font-extrabold text-lg text-green">{loadingC ? '…' : totalClasses}</p>
              <p className="text-[10px] text-muted mt-0.5">Classes</p>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="text-cyan text-base" />
            <h2 className="font-syne font-bold text-white-soft text-sm">Quick Navigation</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Students', link: '/school/students', icon: '👨‍🎓', color: 'border-blue-bright/30 hover:border-blue-bright/60' },
              { label: 'Lecturers', link: '/school/lecturers', icon: '👨‍🏫', color: 'border-cyan/30 hover:border-cyan/60' },
              { label: 'Classes', link: '/school/classes', icon: '📚', color: 'border-green/30 hover:border-green/60' },
              { label: 'Wallet', link: '/school/wallet', icon: '💳', color: 'border-gold/30 hover:border-gold/60' },
              { label: 'Face Approvals', link: '/school/biometric', icon: '🔐', color: 'border-red/30 hover:border-red/60' },
              { label: 'Monitoring', link: '/school/monitoring', icon: '📡', color: 'border-muted/30 hover:border-muted/60' },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.link}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-navy/60 border ${item.color} no-underline text-center transition-all duration-200 hover:-translate-y-0.5 group`}
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
                <span className="text-[11px] font-semibold text-muted group-hover:text-white-soft transition-colors">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
