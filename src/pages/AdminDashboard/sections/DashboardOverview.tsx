import React from 'react';
import { FiAlertTriangle, FiBriefcase, FiRefreshCw, FiUsers } from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutions } from '../../../services/adminApi';
import { fetchUsers } from '../../../services/schoolAdminApi';
import { billingModelLabel } from '../../../utils/billingModel';
import { useNavigate } from 'react-router-dom';

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

export default function DashboardOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { data: institutionRes, loading: loadingI, reload: reloadI } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 100 }),
    [],
  );
  const { data: userRes, loading: loadingU, reload: reloadU } = useAsyncData(
    () => fetchUsers({ page: 1, pageSize: 200 }),
    [],
  );

  const institutions = institutionRes?.items ?? [];
  const users = userRes?.items ?? [];

  const activeInst = institutions.filter((i) => i.status?.toLowerCase() === 'active').length;
  const students = users.filter((u) => u.role?.toLowerCase() === 'student').length;
  const lecturers = users.filter((u) => ['lecturer', 'instructor'].includes(u.role?.toLowerCase())).length;

  const loading = loadingI || loadingU;

  function reloadAll() { reloadI(); reloadU(); }

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
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
