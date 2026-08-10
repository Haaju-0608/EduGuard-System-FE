import React from 'react';
import { FiAlertTriangle, FiBriefcase, FiDollarSign, FiRefreshCw, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutions, fetchRevenueReport, type RevenueReportItem } from '../../../services/adminApi';
import { fetchUsers } from '../../../services/schoolAdminApi';
import { billingModelLabel } from '../../../utils/billingModel';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  loading?: boolean;
  onClick?: () => void;
}

function KpiCard({ label, value, sub, icon, color, bg, loading, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-navy-card border border-border rounded-[20px] p-5 flex items-center gap-4 transition-all ${onClick ? 'cursor-pointer hover:border-blue/30' : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl ${bg} grid place-items-center text-xl shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="space-y-2">
            <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-28 bg-white/5 rounded animate-pulse" />
          </div>
        ) : (
          <>
            <p className={`font-syne font-extrabold text-2xl ${color}`}>{value}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-muted/70 mt-0.5">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function fmtCredits(n: number) {
  return n.toLocaleString('en-US');
}

function fmtDayLabel(period: string) {
  const d = new Date(period);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const REVENUE_WINDOW_DAYS = 30;

export default function DashboardOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { data: institutionRes, loading: loadingI, reload: reloadI } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 100 }),
    [],
  );
  const { data: userRes, loading: loadingU, reload: reloadU } = useAsyncData(
    () => fetchUsers({ page: 1, pageSize: 200 }),
    [],
  );
  const { data: revenue, loading: loadingR, reload: reloadR } = useAsyncData(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - REVENUE_WINDOW_DAYS);
    return fetchRevenueReport({ from: from.toISOString(), to: to.toISOString(), groupBy: 'day' });
  }, []);

  const institutions = institutionRes?.items ?? [];
  const users = userRes?.items ?? [];

  const activeInst = institutions.filter((i) => i.status?.toLowerCase() === 'active').length;
  const students = users.filter((u) => u.role?.toLowerCase() === 'student').length;
  const lecturers = users.filter((u) => ['lecturer', 'instructor'].includes(u.role?.toLowerCase())).length;

  const loading = loadingI || loadingU;

  function reloadAll() { reloadI(); reloadU(); reloadR(); }

  // Doanh thu = topUpAmount (nạp ví) + serviceFeeAmount (đã gồm attendance + proctoring fee) —
  // đúng 2 con số summary mà BE trả về, khớp với cách trang Reports đang hiển thị.
  const totalRevenue = (revenue?.summary.topUpAmount ?? 0) + (revenue?.summary.serviceFeeAmount ?? 0);
  const revenueItems: RevenueReportItem[] = revenue?.items ?? [];
  const maxDailyRevenue = Math.max(1, ...revenueItems.map((it) => it.topUpAmount + it.serviceFeeAmount));

  // Breakdown theo nguồn doanh thu — attendanceFeeAmount + proctoringFeeAmount là 2 thành phần con
  // của serviceFeeAmount, nên 3 mục này cộng lại đúng bằng totalRevenue, không bị đếm trùng.
  const revenueBySource = [
    { label: 'Wallet Top-ups', amount: revenueItems.reduce((s, it) => s + it.topUpAmount, 0), color: 'bg-blue-bright' },
    { label: 'Attendance Fees', amount: revenueItems.reduce((s, it) => s + it.attendanceFeeAmount, 0), color: 'bg-cyan' },
    { label: 'Proctoring Fees', amount: revenueItems.reduce((s, it) => s + it.proctoringFeeAmount, 0), color: 'bg-gold' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Platform Overview</h1>
          <p className="text-muted text-sm mt-1">Real-time statistics across all institutions.</p>
        </div>
        <button
          onClick={reloadAll}
          disabled={loading || loadingR}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={(loading || loadingR) ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Institutions"
          value={institutions.length}
          sub={`${activeInst} active`}
          icon={<FiBriefcase />}
          color="text-blue-bright"
          bg="bg-blue/10"
          loading={loadingI}
          onClick={() => onNavigate('/admin/institutions')}
        />
        <KpiCard
          label="Total Users"
          value={users.length}
          sub={`${students} students · ${lecturers} lecturers`}
          icon={<FiUsers />}
          color="text-cyan"
          bg="bg-cyan/10"
          loading={loadingU}
          onClick={() => onNavigate('/admin/users')}
        />
        <KpiCard
          label={`Revenue (${REVENUE_WINDOW_DAYS}d)`}
          value={fmtCredits(totalRevenue)}
          sub={`${revenue?.summary.transactionCount ?? 0} transactions · credits`}
          icon={<FiDollarSign />}
          color="text-green"
          bg="bg-green/10"
          loading={loadingR}
          onClick={() => onNavigate('/admin/reports')}
        />
        <KpiCard
          label="Suspended Institutions"
          value={institutions.filter((i) => i.status?.toLowerCase() === 'suspended').length}
          sub="Requires attention"
          icon={<FiAlertTriangle />}
          color="text-red"
          bg="bg-red/10"
          loading={loadingI}
          onClick={() => onNavigate('/admin/institutions')}
        />
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Daily revenue trend */}
        <div className="lg:col-span-3 bg-navy-card border border-border rounded-[20px] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <FiTrendingUp className="text-green" />
              Revenue Trend
            </h3>
            <button onClick={() => onNavigate('/admin/reports')} className="text-xs text-blue-bright hover:underline bg-transparent border-none cursor-pointer">Full report</button>
          </div>
          {loadingR ? (
            <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
          ) : revenueItems.length === 0 ? (
            <p className="text-muted text-sm text-center py-14">No revenue recorded in the last {REVENUE_WINDOW_DAYS} days.</p>
          ) : (
            <div className="flex items-end gap-1 h-40 overflow-x-auto custom-scrollbar pb-1">
              {revenueItems.map((it) => {
                const dayTotal = it.topUpAmount + it.serviceFeeAmount;
                const pct = Math.max(2, Math.round((dayTotal / maxDailyRevenue) * 100));
                return (
                  <div key={it.period} className="flex flex-col items-center justify-end h-full shrink-0 w-6 group relative">
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-navy border border-border rounded-md px-1.5 py-0.5 whitespace-nowrap text-white-soft pointer-events-none z-10">
                      {fmtCredits(dayTotal)}
                    </div>
                    <div
                      className="w-full rounded-t-sm bg-green/70 group-hover:bg-green transition-colors"
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-[8px] text-muted mt-1 rotate-0">{fmtDayLabel(it.period)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue by source */}
        <div className="lg:col-span-2 bg-navy-card border border-border rounded-[20px] p-5">
          <h3 className="font-syne font-bold text-white-soft text-base flex items-center gap-2 mb-4">
            <FiDollarSign className="text-green" />
            Revenue by Source
          </h3>
          {loadingR ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : totalRevenue === 0 ? (
            <p className="text-muted text-sm text-center py-14">No revenue recorded in the last {REVENUE_WINDOW_DAYS} days.</p>
          ) : (
            <div className="space-y-3.5">
              {revenueBySource.map((s) => {
                const pct = totalRevenue === 0 ? 0 : Math.round((s.amount / totalRevenue) * 100);
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white-soft font-medium">{s.label}</span>
                      <span className="text-muted font-mono">{fmtCredits(s.amount)} <span className="text-muted/70">({pct}%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-navy rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Institution breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Institutions list */}
        <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-white-soft">Recent Institutions</p>
            <button onClick={() => onNavigate('/admin/institutions')} className="text-xs text-blue-bright hover:underline bg-transparent border-none cursor-pointer">View all</button>
          </div>
          {loadingI ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 bg-white/5 rounded-xl animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
                    <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : institutions.length === 0 ? (
            <div className="py-10 text-center text-muted text-sm">No institutions yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {institutions.slice(0, 6).map((inst) => (
                <div key={inst.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-navy/40 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-xs font-bold text-blue-bright shrink-0">
                    {(inst.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{inst.name ?? '—'}</p>
                    <p className="text-[11px] text-muted">{billingModelLabel(inst.billingModel)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    inst.status?.toLowerCase() === 'active'
                      ? 'text-green bg-green/10 border-green/25'
                      : 'text-red bg-red/10 border-red/25'
                  }`}>{inst.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User role breakdown */}
        <div className="bg-navy-card border border-border rounded-[20px] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <p className="text-sm font-bold text-white-soft">User Breakdown</p>
            <button onClick={() => onNavigate('/admin/users')} className="text-xs text-blue-bright hover:underline bg-transparent border-none cursor-pointer">View all</button>
          </div>
          {loadingU ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Students', count: students, color: 'bg-blue-bright', total: users.length },
                { label: 'Lecturers', count: lecturers, color: 'bg-gold', total: users.length },
                { label: 'School Admins', count: users.filter((u) => u.role?.toLowerCase().includes('schooladmin')).length, color: 'bg-cyan', total: users.length },
                { label: 'Others', count: users.filter((u) => !['student','lecturer','instructor','schooladmin'].includes(u.role?.toLowerCase())).length, color: 'bg-muted', total: users.length },
              ].map(({ label, count, color, total }) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted">{label}</span>
                      <span className="text-white-soft font-semibold">{count} <span className="text-muted font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-navy rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
