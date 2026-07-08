import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchStudentExamSlots } from '../../../services/schoolAdminApi';
import type { ExamSlot, ExamSlotStatus } from '../../../types/lecturer';

// ─── Mock fallback (dùng khi API chưa filter được theo enrollment) ─────────
const MOCK_EXAM_SLOTS: ExamSlot[] = [
  {
    id: 'mock-1',
    classId: 'class-oop',
    classCode: 'OOP212',
    className: 'Object Oriented Programming',
    examName: 'Midterm Exam',
    startTime: '2026-07-10T07:30:00.000Z',
    endTime:   '2026-07-10T09:30:00.000Z',
    durationMinutes: 90,
    status: 'scheduled',
  },
  {
    id: 'mock-2',
    classId: 'class-ds',
    classCode: 'DS201',
    className: 'Data Structures & Algorithms',
    examName: 'Chapter 3 Quiz',
    startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    endTime:   new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    status: 'ongoing',
  },
  {
    id: 'mock-3',
    classId: 'class-db',
    classCode: 'DB301',
    className: 'Database Systems',
    examName: 'Final Exam',
    startTime: '2026-07-15T13:00:00.000Z',
    endTime:   '2026-07-15T15:30:00.000Z',
    durationMinutes: 120,
    status: 'scheduled',
  },
  {
    id: 'mock-4',
    classId: 'class-se',
    classCode: 'SE401',
    className: 'Software Engineering',
    examName: 'Lab Test 2',
    startTime: '2026-06-25T09:00:00.000Z',
    endTime:   '2026-06-25T10:30:00.000Z',
    durationMinutes: 90,
    status: 'completed',
  },
  {
    id: 'mock-5',
    classId: 'class-oop',
    classCode: 'OOP212',
    className: 'Object Oriented Programming',
    examName: 'Lab Test 1',
    startTime: '2026-06-20T07:30:00.000Z',
    endTime:   '2026-06-20T09:00:00.000Z',
    durationMinutes: 90,
    status: 'completed',
  },
  {
    id: 'mock-6',
    classId: 'class-net',
    classCode: 'NET305',
    className: 'Computer Networks',
    examName: 'Midterm Exam',
    startTime: '2026-07-01T13:00:00.000Z',
    endTime:   '2026-07-01T14:30:00.000Z',
    durationMinutes: 90,
    status: 'cancelled',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

type StudentStatus = 'upcoming' | 'available' | 'completed' | 'missed';

function deriveStudentStatus(slot: ExamSlot): StudentStatus {
  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();

  if (slot.status === 'completed') return 'completed';
  if (slot.status === 'cancelled') return 'missed';
  if (slot.status === 'ongoing') return 'available';
  // scheduled: derive from time
  if (now < start) return 'upcoming';
  if (now <= end) return 'available';
  return 'missed';
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; cls: string; dot: string }> = {
  available: { label: 'Available', cls: 'text-green bg-green/10 border-green/25', dot: 'bg-green animate-pulse' },
  upcoming:  { label: 'Upcoming',  cls: 'text-gold bg-gold/10 border-gold/25',    dot: 'bg-gold' },
  completed: { label: 'Completed', cls: 'text-muted bg-white/5 border-border',    dot: 'bg-muted' },
  missed:    { label: 'Missed',    cls: 'text-red bg-red/10 border-red/25',        dot: 'bg-red' },
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentExamsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudentStatus | 'all'>('all');

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user?.id) return [];
    return fetchStudentExamSlots(user.id);
  }, [user?.id]);

  const slots = data && data.length > 0 ? data : MOCK_EXAM_SLOTS;

  const filtered = slots.filter((slot) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      slot.examName.toLowerCase().includes(q) ||
      slot.classCode.toLowerCase().includes(q) ||
      slot.className.toLowerCase().includes(q);
    const status = deriveStudentStatus(slot);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  const handleStart = (slot: ExamSlot) => {
    localStorage.setItem(`studentExam_${slot.id}`, JSON.stringify(slot));
    navigate(`/student/exams/${slot.id}/verify`);
  };

  const counts = {
    total:     slots.length,
    available: slots.filter((s) => deriveStudentStatus(s) === 'available').length,
    upcoming:  slots.filter((s) => deriveStudentStatus(s) === 'upcoming').length,
    completed: slots.filter((s) => deriveStudentStatus(s) === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Exams</h1>
        <p className="text-muted text-sm mt-1">View your scheduled exams and start available ones.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: counts.total,     color: 'text-blue-bright' },
          { label: 'Available', value: counts.available, color: 'text-green' },
          { label: 'Upcoming',  value: counts.upcoming,  color: 'text-gold' },
          { label: 'Completed', value: counts.completed, color: 'text-muted' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-50 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search exam or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'available', 'upcoming', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all capitalize ${
                filter === s
                  ? 'bg-blue text-white border-blue'
                  : 'bg-transparent text-muted border-border hover:border-blue/40'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] p-5 animate-pulse h-44" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📝</p>
          <p className="text-muted text-sm">No exams found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((slot) => {
            const studentStatus = deriveStudentStatus(slot);
            const cfg = STATUS_CONFIG[studentStatus];
            const canStart = studentStatus === 'available';
            return (
              <div key={slot.id} className="bg-navy-card border border-border rounded-[20px] p-5 flex flex-col gap-4">
                {/* Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
                      {slot.classCode}
                    </span>
                    <h3 className="font-syne font-bold text-white-soft text-base mt-2">{slot.examName}</h3>
                    <p className="text-xs text-muted mt-0.5 truncate">{slot.className}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${cfg.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                    <FiCalendar className="text-cyan shrink-0" />
                    <span>{fmtDT(slot.startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                    <FiClock className="text-cyan shrink-0" />
                    <span>{slot.durationMinutes > 0 ? `${slot.durationMinutes} min` : 'Duration not set'}</span>
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => canStart && handleStart(slot)}
                  disabled={!canStart}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    canStart
                      ? 'bg-blue text-white border-blue hover:bg-blue/80'
                      : studentStatus === 'completed'
                        ? 'bg-transparent text-muted border-border cursor-not-allowed'
                        : studentStatus === 'missed'
                          ? 'bg-transparent text-red border-red/30 cursor-not-allowed'
                          : 'bg-transparent text-gold border-gold/30 cursor-not-allowed'
                  }`}
                >
                  {canStart
                    ? '🚀 Start Exam'
                    : studentStatus === 'completed'
                      ? '✅ Completed'
                      : studentStatus === 'missed'
                        ? '❌ Missed'
                        : '⏳ Not Started Yet'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
