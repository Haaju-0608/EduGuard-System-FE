import React, { useMemo, useState } from 'react';
import { FiCalendar, FiCheck, FiClock, FiSearch, FiX } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';

// ─── Mock data ────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string;
  className: string;
  classCode: string;
  startTime: string;
  endTime: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string;
}

const MOCK_RECORDS: AttendanceRecord[] = [
  { id: '1',  date: '2026-06-26', className: 'Object Oriented Programming', classCode: 'OP212', startTime: '07:30', endTime: '09:00', status: 'present' },
  { id: '2',  date: '2026-06-26', className: 'Data Structures', classCode: 'DS201', startTime: '09:15', endTime: '10:45', status: 'late', note: 'Arrived 12 min late' },
  { id: '3',  date: '2026-06-25', className: 'Database Systems', classCode: 'DB301', startTime: '13:00', endTime: '14:30', status: 'present' },
  { id: '4',  date: '2026-06-25', className: 'Object Oriented Programming', classCode: 'OP212', startTime: '07:30', endTime: '09:00', status: 'present' },
  { id: '5',  date: '2026-06-24', className: 'Data Structures', classCode: 'DS201', startTime: '09:15', endTime: '10:45', status: 'absent' },
  { id: '6',  date: '2026-06-24', className: 'Software Engineering', classCode: 'SE401', startTime: '13:00', endTime: '14:30', status: 'present' },
  { id: '7',  date: '2026-06-23', className: 'Database Systems', classCode: 'DB301', startTime: '13:00', endTime: '14:30', status: 'excused', note: 'Medical leave' },
  { id: '8',  date: '2026-06-23', className: 'Software Engineering', classCode: 'SE401', startTime: '07:30', endTime: '09:00', status: 'present' },
  { id: '9',  date: '2026-06-20', className: 'Object Oriented Programming', classCode: 'OP212', startTime: '07:30', endTime: '09:00', status: 'present' },
  { id: '10', date: '2026-06-20', className: 'Data Structures', classCode: 'DS201', startTime: '09:15', endTime: '10:45', status: 'present' },
  { id: '11', date: '2026-06-19', className: 'Database Systems', classCode: 'DB301', startTime: '13:00', endTime: '14:30', status: 'present' },
  { id: '12', date: '2026-06-19', className: 'Software Engineering', classCode: 'SE401', startTime: '13:00', endTime: '14:30', status: 'absent' },
  { id: '13', date: '2026-06-18', className: 'Object Oriented Programming', classCode: 'OP212', startTime: '07:30', endTime: '09:00', status: 'late', note: 'Arrived 5 min late' },
  { id: '14', date: '2026-06-18', className: 'Data Structures', classCode: 'DS201', startTime: '09:15', endTime: '10:45', status: 'present' },
];

const CLASSES = [...new Set(MOCK_RECORDS.map((r) => r.classCode))];

const STATUS_CONFIG = {
  present: { label: 'Present',  cls: 'text-green  bg-green/10  border-green/25',  icon: <FiCheck className="text-xs" />, dot: 'bg-green' },
  late:    { label: 'Late',     cls: 'text-gold   bg-gold/10   border-gold/25',   icon: <FiClock className="text-xs" />, dot: 'bg-gold' },
  absent:  { label: 'Absent',   cls: 'text-red    bg-red/10    border-red/25',    icon: <FiX className="text-xs" />,    dot: 'bg-red' },
  excused: { label: 'Excused',  cls: 'text-cyan   bg-cyan/10   border-cyan/25',   icon: <FiCalendar className="text-xs" />, dot: 'bg-cyan' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentAttendancePage() {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AttendanceRecord['status'] | 'all'>('all');

  const filtered = useMemo(() => MOCK_RECORDS.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.className.toLowerCase().includes(q) || r.classCode.toLowerCase().includes(q);
    const matchClass = classFilter === 'all' || r.classCode === classFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchClass && matchStatus;
  }), [search, classFilter, statusFilter]);

  // KPI
  const total   = MOCK_RECORDS.length;
  const present = MOCK_RECORDS.filter((r) => r.status === 'present').length;
  const late    = MOCK_RECORDS.filter((r) => r.status === 'late').length;
  const absent  = MOCK_RECORDS.filter((r) => r.status === 'absent').length;
  const rate    = Math.round(((present + late) / total) * 100);

  // Per-class breakdown
  const classBreakdown = useMemo(() => {
    return CLASSES.map((code) => {
      const recs = MOCK_RECORDS.filter((r) => r.classCode === code);
      const p = recs.filter((r) => r.status === 'present' || r.status === 'late').length;
      const name = recs[0]?.className ?? code;
      return { code, name, total: recs.length, attended: p, pct: Math.round((p / recs.length) * 100) };
    });
  }, []);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    filtered.forEach((r) => {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    });
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">Attendance</h1>
        <p className="text-muted text-sm mt-1">Track your attendance across all classes.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Attendance Rate', value: `${rate}%`, color: rate >= 80 ? 'text-green' : rate >= 60 ? 'text-gold' : 'text-red', icon: '📊' },
          { label: 'Present',  value: present, color: 'text-green', icon: '✅' },
          { label: 'Late',     value: late,    color: 'text-gold',  icon: '⏰' },
          { label: 'Absent',   value: absent,  color: 'text-red',   icon: '❌' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4">
            <div className="text-lg mb-1">{k.icon}</div>
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Per-class breakdown */}
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
          options={[{value:'all',label:'All Classes'}, ...CLASSES.map((c) => ({value:c,label:c}))]}
        />
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as AttendanceRecord['status'] | 'all')}
          options={[
            {value:'all',label:'All Statuses'},
            {value:'present',label:'Present'},
            {value:'late',label:'Late'},
            {value:'absent',label:'Absent'},
            {value:'excused',label:'Excused'},
          ]}
        />
      </div>

      {/* Records grouped by date */}
      {grouped.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-muted text-sm">No attendance records found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, records]) => (
            <div key={date} className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
              {/* Date header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-navy/40">
                <FiCalendar className="text-muted text-sm shrink-0" />
                <span className="text-sm font-semibold text-white-soft">{fmtDate(date)}</span>
                <span className="ml-auto text-xs text-muted">{records.length} session{records.length > 1 ? 's' : ''}</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-border">
                {records.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  return (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy/30 transition-colors">
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      {/* Class */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold font-mono text-muted bg-navy border border-border px-1.5 py-0.5 rounded">{r.classCode}</span>
                          <span className="text-sm font-semibold text-white-soft truncate">{r.className}</span>
                        </div>
                        {r.note && <p className="text-xs text-muted mt-0.5 italic">{r.note}</p>}
                      </div>
                      {/* Time */}
                      <div className="text-xs text-muted shrink-0 hidden sm:block">
                        {r.startTime} – {r.endTime}
                      </div>
                      {/* Status badge */}
                      <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${cfg.cls}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
