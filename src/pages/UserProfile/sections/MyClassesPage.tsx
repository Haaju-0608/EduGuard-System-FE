import React from 'react';
import { FiBook, FiCalendar, FiMapPin, FiRefreshCw, FiUsers } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { apiGetPaginated, buildQueryParams } from '../../../services/apiClient';
import type { ApiEnrollment } from '../../../types/api';

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === 'active' ? 'text-green bg-green/10 border-green/25' :
    s === 'upcoming' ? 'text-gold bg-gold/10 border-gold/25' :
    'text-muted bg-white/5 border-border';
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function MyClassesPage() {
  const { user } = useAuth();

  const { data, loading, error, reload } = useAsyncData(async () => {
    const res = await apiGetPaginated<ApiEnrollment[]>(
      `/api/enrollments${buildQueryParams({ page: 1, pageSize: 100 })}`,
    );
    return res.data.filter((e) => e.studentId === user?.id || e.student?.id === user?.id);
  }, [user?.id]);

  const enrollments = data ?? [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="uni-page-banner rounded-[24px] p-6 relative overflow-hidden">
        <div className="uni-banner-grid absolute inset-0 z-0 opacity-40" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue to-cyan text-white flex items-center justify-center text-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)]">
              <FiBook />
            </div>
            <div>
              <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Classes</h1>
              <p className="text-muted text-sm mt-0.5">All courses you are currently enrolled in.</p>
            </div>
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-navy-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue/10 grid place-items-center text-blue-bright">
            <FiBook />
          </div>
          <div>
            <p className="font-syne font-extrabold text-xl text-blue-bright">{loading ? '…' : enrollments.length}</p>
            <p className="text-[11px] text-muted">Enrolled Courses</p>
          </div>
        </div>
        <div className="bg-navy-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green/10 grid place-items-center text-green">
            <FiUsers />
          </div>
          <div>
            <p className="font-syne font-extrabold text-xl text-green">
              {loading ? '…' : enrollments.filter((e) => e.status?.toLowerCase() === 'active').length}
            </p>
            <p className="text-[11px] text-muted">Active Classes</p>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-navy-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted">
          <p className="text-red mb-2">Failed to load classes. {error}</p>
          <button onClick={reload} className="text-sm text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-navy/60 border border-border flex items-center justify-center text-3xl mx-auto mb-4">📚</div>
          <h3 className="font-syne font-bold text-base text-white-soft mb-1">No classes yet</h3>
          <p className="text-sm text-muted max-w-[280px] mx-auto">
            You are not enrolled in any class yet. Contact your School Admin to get enrolled.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e, i) => {
            const cls = e.class;
            const name = cls?.courseName ?? 'Unknown Class';
            const code = cls?.courseCode ?? '—';
            const semester = cls?.semester ?? '—';
            const start = fmt(cls?.startDate);
            const end = fmt(cls?.endDate);
            const enrolledAt = fmt(e.enrolledAt);

            return (
              <div
                key={`${e.classId}-${e.studentId}`}
                className="bg-navy-card border border-border rounded-[20px] p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-blue/30 transition-colors animate-fade-slide-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-blue/10 border border-blue/20 grid place-items-center text-xl shrink-0">
                  📖
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-mono font-extrabold text-blue-bright bg-blue/10 px-2 py-0.5 rounded">
                      {code}
                    </span>
                    <h3 className="font-syne font-bold text-white-soft text-base truncate">{name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <FiCalendar className="text-cyan text-[10px]" />
                      Semester {semester}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiMapPin className="text-cyan text-[10px]" />
                      {start} → {end}
                    </span>
                    <span>Enrolled: {enrolledAt}</span>
                  </div>
                </div>

                {/* Status */}
                <StatusBadge status={e.status ?? 'active'} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
