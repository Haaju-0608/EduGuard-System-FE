import React, { useMemo, useState } from 'react';
import { FiCalendar, FiCheck, FiClock, FiRefreshCw, FiSearch, FiX } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchStudentAttendanceHistory } from '../../../services/schoolAdminApi';
import type { StudentAttendanceRecord } from '../../../services/schoolAdminApi';

const STATUS_CONFIG: Record<StudentAttendanceRecord['status'], {
  label: string; cls: string; icon: React.ReactNode; dot: string;
}> = {
  present: { label: 'Present', cls: 'text-green  bg-green/10  border-green/25',  icon: <FiCheck className="text-xs" />, dot: 'bg-green' },
  late:    { label: 'Late',    cls: 'text-gold   bg-gold/10   border-gold/25',   icon: <FiClock className="text-xs" />, dot: 'bg-gold' },
  absent:  { label: 'Absent',  cls: 'text-red    bg-red/10    border-red/25',    icon: <FiX className="text-xs" />,    dot: 'bg-red' },
  excused: { label: 'Excused', cls: 'text-cyan   bg-cyan/10   border-cyan/25',   icon: <FiCalendar className="text-xs" />, dot: 'bg-cyan' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StudentAttendanceRecord['status'] | 'all'>('all');

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user?.id) return [];
    return fetchStudentAttendanceHistory(user.id);
  }, [user?.id]);

  const records = data ?? [];

  const classCodes = useMemo(
    () => [...new Set(records.map((r) => r.classCode))].sort(),
    [records],
  );

  const filtered = useMemo(() => records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.className.toLowerCase().includes(q) || r.classCode.toLowerCase().includes(q);
    const matchClass  = classFilter === 'all' || r.classCode === classFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchClass && matchStatus;
  }), [records, search, classFilter, statusFilter]);

  const total   = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const late    = records.filter((r) => r.status === 'late').length;
  const absent  = records.filter((r) => r.status === 'absent').length;
  const rate    = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const classBreakdown = useMemo(() => {
    return classCodes.map((code) => {
      const recs = records.filter((r) => r.classCode === code);
      const attended = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
      const name = recs[0]?.className ?? code;
      return { code, name, total: recs.length, attended, pct: Math.round((attended / recs.length) * 100) };
    });
  }, [records, classCodes]);

  const groupedByClass = useMemo(() => {
    const map = new Map<string, StudentAttendanceRecord[]>();
    filtered.forEach((r) => {
      if (!map.has(r.classCode)) map.set(r.classCode, []);
      map.get(r.classCode)!.push(r);
    });
    return [...map.entries()]
      .map(([code, recs]) => ({
        code,
        name: recs[0]?.className ?? code,
        recs: [...recs].sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Attendance</h1>
          <p className="text-muted text-sm mt-1">Track your attendance across all classes.</p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Attendance Rate', value: loading ? '…' : `${rate}%`, color: rate >= 80 ? 'text-green' : rate >= 60 ? 'text-gold' : 'text-red', icon: '📊' },
          { label: 'Present',  value: loading ? '…' : present, color: 'text-green', icon: '✅' },
          { label: 'Late',     value: loading ? '…' : late,    color: 'text-gold',  icon: '⏰' },
          { label: 'Absent',   value: loading ? '…' : absent,  color: 'text-red',   icon: '❌' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4">
            <div className="text-lg mb-1">{k.icon}</div>
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Per-class breakdown */}
      {classBreakdown.length > 0 && (
        <div className="bg-navy-card border border-border rounded-[20px] p-5 space-y-4">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">Attendance by Class</p>
          <div className="space-y-3">
            {classBreakdown.map((c) => (
              <div key={c.code} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold font-mono text-muted bg-navy border border-border px-2 py-0.5 rounded-full shrink-0">{c.code}</span>
                    <span className="text-white-soft font-medium truncate">{c.name}</span>
                  </div>
                  <span className={`font-bold shrink-0 ml-3 ${c.pct >= 80 ? 'text-green' : c.pct >= 60 ? 'text-gold' : 'text-red'}`}>
                    {c.pct}% <span className="text-muted font-normal text-xs">({c.attended}/{c.total})</span>
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.pct >= 80 ? 'bg-green' : c.pct >= 60 ? 'bg-gold' : 'bg-red'}`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <CustomSelect
          value={classFilter}
          onChange={setClassFilter}
          options={[{ value: 'all', label: 'All Classes' }, ...classCodes.map((c) => ({ value: c, label: c }))]}
        />
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StudentAttendanceRecord['status'] | 'all')}
          options={[
            { value: 'all',     label: 'All Statuses' },
            { value: 'present', label: 'Present' },
            { value: 'late',    label: 'Late' },
            { value: 'absent',  label: 'Absent' },
            { value: 'excused', label: 'Excused' },
          ]}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center space-y-3">
          <p className="text-3xl">⚠️</p>
          <p className="text-red text-sm">{error}</p>
          <button onClick={reload} className="text-blue-bright text-sm underline cursor-pointer bg-transparent border-none">Retry</button>
        </div>
      ) : groupedByClass.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-muted text-sm">
            {search || classFilter !== 'all' || statusFilter !== 'all'
              ? 'No records match your filter.'
              : 'No attendance records yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByClass.map((g) => (
            <div key={g.code} className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-navy/40">
                <span className="text-[10px] font-bold font-mono text-blue-bright bg-blue/10 border border-blue/25 px-2 py-0.5 rounded-full shrink-0">{g.code}</span>
                <span className="text-sm font-semibold text-white-soft truncate">{g.name}</span>
                <span className="ml-auto text-xs text-muted shrink-0">{g.recs.length} session{g.recs.length > 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-border">
                      <th className="text-left font-semibold px-5 py-2.5">Date</th>
                      <th className="text-left font-semibold px-5 py-2.5">Exam</th>
                      <th className="text-left font-semibold px-5 py-2.5">Proctoring Lecturer</th>
                      <th className="text-left font-semibold px-5 py-2.5 hidden sm:table-cell">Check-in</th>
                      <th className="text-right font-semibold px-5 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {g.recs.map((r) => {
                      const cfg = STATUS_CONFIG[r.status];
                      return (
                        <tr key={r.id} className="hover:bg-navy/30 transition-colors">
                          <td className="px-5 py-3 text-white-soft whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              <FiCalendar className="text-muted text-xs shrink-0" />
                              {fmtDate(r.date)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-white-soft truncate max-w-45">{r.examName ?? <span className="text-muted">—</span>}</td>
                          <td className="px-5 py-3 text-muted truncate max-w-55">{r.lecturerName ?? '—'}</td>
                          <td className="px-5 py-3 text-muted hidden sm:table-cell">{r.checkInTime ?? '—'}</td>
                          <td className="px-5 py-3 text-right">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
