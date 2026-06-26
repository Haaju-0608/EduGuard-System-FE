import React, { useState } from 'react';
import { FiSearch, FiActivity, FiCheckCircle, FiXCircle, FiClock, FiFileText, FiAward } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';

interface AttendanceRecord {
  id: string;
  courseCode: string;
  courseName: string;
  date: string;
  time: string;
  room: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  method: string;
}

const attendanceRecords: AttendanceRecord[] = [
  { id: '1', courseCode: 'CS201', courseName: 'Web Programming', date: '2026-06-07', time: '07:42', room: 'A2-301', status: 'present', method: 'AI Face ID' },
  { id: '2', courseCode: 'CS101', courseName: 'Database Systems', date: '2026-06-06', time: '09:48', room: 'B1-205', status: 'present', method: 'AI Face ID' },
  { id: '3', courseCode: 'CS302', courseName: 'Software Engineering', date: '2026-06-05', time: '—', room: 'C3-102', status: 'absent', method: '—' },
  { id: '4', courseCode: 'CS201', courseName: 'Web Programming', date: '2026-06-04', time: '07:55', room: 'A2-301', status: 'late', method: 'Manual check' },
  { id: '5', courseCode: 'CS101', courseName: 'Database Systems', date: '2026-06-03', time: '09:41', room: 'B1-205', status: 'present', method: 'AI Face ID' },
  { id: '6', courseCode: 'MATH101', courseName: 'Math Analysis', date: '2026-06-02', time: '13:40', room: 'Hall A', status: 'present', method: 'AI Face ID' },
  { id: '7', courseCode: 'ENG201', courseName: 'English Communication', date: '2026-06-01', time: '15:05', room: 'C3-102', status: 'excused', method: 'Medical note' },
  { id: '8', courseCode: 'CS302', courseName: 'Software Engineering', date: '2026-05-29', time: '15:01', room: 'C3-102', status: 'present', method: 'AI Face ID' },
  { id: '9', courseCode: 'MATH101', courseName: 'Math Analysis', date: '2026-05-28', time: '13:35', room: 'Hall A', status: 'present', method: 'AI Face ID' },
];

const courseStats = [
  { code: 'CS201', name: 'Web Programming', attended: 12, total: 13, rate: 92, color: 'text-blue-bright', gradient: 'from-blue to-cyan' },
  { code: 'CS101', name: 'Database Systems', attended: 10, total: 11, rate: 90, color: 'text-gold', gradient: 'from-gold to-amber-500' },
  { code: 'CS302', name: 'Software Engineering', attended: 8, total: 10, rate: 80, color: 'text-purple-500', gradient: 'from-purple-500 to-indigo-500' },
  { code: 'MATH101', name: 'Math Analysis', attended: 9, total: 10, rate: 90, color: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' },
  { code: 'ENG201', name: 'English Communication', attended: 7, total: 9, rate: 77, color: 'text-cyan', gradient: 'from-cyan to-teal-500' },
];

function StatusBadge({ status }: { status: AttendanceRecord['status'] }) {
  const config = {
    present: { label: 'Present', className: 'text-green bg-green/10 border-green/20' },
    absent: { label: 'Absent', className: 'text-red bg-red/10 border-red/20' },
    late: { label: 'Late', className: 'text-gold bg-gold/10 border-gold/20' },
    excused: { label: 'Excused', className: 'text-blue-bright bg-blue/10 border-blue/20' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>
  );
}

export default function AttendanceHistoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredRecords = attendanceRecords.filter((r) => {
    const matchesSearch = r.courseName.toLowerCase().includes(search.toLowerCase()) || r.courseCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* ── Page Header (Mesh style) ── */}
      <div className="uni-page-banner rounded-[24px] p-6 relative overflow-hidden group">
        <div className="uni-banner-grid absolute inset-0 z-0 opacity-40" />
        
        {/* Glow Orb */}
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-[60px] opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity duration-700"
          style={{ background: 'radial-gradient(circle, var(--color-blue) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue to-cyan text-white flex items-center justify-center text-xl shadow-[0_4px_12px_rgba(37,99,235,0.2)]">
              <FiActivity />
            </div>
            <div>
              <h1 className="font-syne text-2xl font-extrabold text-white-soft">Attendance History</h1>
              <p className="text-muted text-sm mt-0.5">Track and analyze your class check-in reports and verification methods.</p>
            </div>
          </div>

          {/* Glowing KPI Stats inside banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:min-w-[400px]">
            {[
              { label: 'Overall Rate', value: '85.2%', color: 'text-blue-bright', bg: 'bg-blue/5' },
              { label: 'Present', value: '46', color: 'text-green', bg: 'bg-green/5' },
              { label: 'Absent', value: '4', color: 'text-red', bg: 'bg-red/5' },
              { label: 'Late', value: '3', color: 'text-gold', bg: 'bg-gold/5' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-border/50 rounded-xl p-2.5 text-center`}>
                <p className={`font-syne font-extrabold text-lg ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted uppercase tracking-wider font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Course Progress & Detailed logs */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6">
        
        {/* Left column: Course Progress */}
        <div className="bg-navy-card border border-border rounded-[24px] p-6 space-y-4 h-fit">
          <h2 className="font-syne font-bold text-lg text-white-soft flex items-center gap-2 mb-2 border-b border-border pb-3">
            <FiAward className="text-blue-bright" />
            Subject Summary
          </h2>
          <div className="space-y-4">
            {courseStats.map((c) => (
              <div key={c.code} className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className={`font-mono font-bold ${c.color} mr-1.5`}>{c.code}</span>
                    <span className="text-white-soft font-semibold">{c.name}</span>
                  </div>
                  <span className="text-muted font-bold">{c.rate}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full bg-navy rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${c.gradient}`}
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted">
                  <span>Attended: {c.attended} sessions</span>
                  <span>Total: {c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Detailed logs */}
        <div className="bg-navy-card border border-border rounded-[24px] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 mb-4">
            <h2 className="font-syne font-bold text-lg text-white-soft">Attendance Logs</h2>
            
            {/* Filters */}
            <div className="flex gap-2 flex-wrap w-full sm:w-auto">
              <div className="uni-filter-input relative !py-2 !px-3 flex-1 sm:flex-initial sm:min-w-[180px]">
                <FiSearch className="text-muted text-xs shrink-0" />
                <input
                  type="text"
                  placeholder="Filter by course..."
                  className="text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  {value:'all',label:'All Status'},
                  {value:'present',label:'Present'},
                  {value:'absent',label:'Absent'},
                  {value:'late',label:'Late'},
                  {value:'excused',label:'Excused'},
                ]}
              />
            </div>
          </div>

          {/* Roster logs */}
          <div className="space-y-3">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-16 text-muted space-y-3">
                <div className="w-16 h-16 rounded-full bg-navy/60 border border-border flex items-center justify-center text-3xl mx-auto">📭</div>
                <h3 className="font-syne font-bold text-base text-white-soft pt-1">No check-ins found</h3>
                <p className="text-xs text-muted max-w-[280px] mx-auto leading-relaxed">Try changing the filters or search keyword above.</p>
              </div>
            ) : (
              filteredRecords.map((r, i) => (
                <div
                  key={r.id}
                  className="roster-item transition-all duration-300 hover:border-cyan/25 hover:translate-x-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.03)]"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-extrabold text-cyan bg-cyan/10 px-2 py-0.5 rounded">
                        {r.courseCode}
                      </span>
                      <span className="text-sm font-bold text-white-soft">{r.courseName}</span>
                    </div>
                    <div className="flex gap-x-4 gap-y-1.5 text-[10px] text-muted mt-1 font-dm flex-wrap">
                      <span className="flex items-center gap-1">📅 {r.date}</span>
                      <span className="flex items-center gap-1">🕐 Time: <strong className="text-white-soft font-mono font-medium">{r.time}</strong></span>
                      <span className="flex items-center gap-1">📍 Room: <strong className="text-white-soft font-medium">{r.room}</strong></span>
                      <span className="flex items-center gap-1">🛡️ Method: <strong className="text-cyan font-semibold">{r.method}</strong></span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
