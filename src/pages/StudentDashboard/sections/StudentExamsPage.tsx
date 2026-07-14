import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchExamParticipations, fetchStudentExamSlots } from '../../../services/schoolAdminApi';
import { useToast } from '../../../contexts/ToastContext';
import type { ExamSlot } from '../../../types/lecturer';
import type { ParticipationStatus } from '../../../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────

type StudentStatus = 'upcoming' | 'available' | 'completed' | 'missed' | 'submitted' | 'disqualified';

function deriveStudentStatus(slot: ExamSlot, participationStatus?: ParticipationStatus): StudentStatus {
  // Participation status takes precedence for the current student
  if (participationStatus === 'Submitted') return 'submitted';
  if (participationStatus === 'Disqualified') return 'disqualified';

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
  available:    { label: 'Available',    cls: 'text-green bg-green/10 border-green/25',    dot: 'bg-green animate-pulse' },
  upcoming:     { label: 'Upcoming',     cls: 'text-gold bg-gold/10 border-gold/25',        dot: 'bg-gold' },
  completed:    { label: 'Completed',    cls: 'text-muted bg-white/5 border-border',        dot: 'bg-muted' },
  missed:       { label: 'Missed',       cls: 'text-red bg-red/10 border-red/25',           dot: 'bg-red' },
  submitted:    { label: 'Submitted',    cls: 'text-cyan bg-cyan/10 border-cyan/25',        dot: 'bg-cyan' },
  disqualified: { label: 'Disqualified', cls: 'text-red bg-red/10 border-red/25',           dot: 'bg-red' },
};

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentExamsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StudentStatus | 'all'>('all');
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user?.id) return { slots: [], participations: {} as Record<string, ParticipationStatus> };
    const slots = await fetchStudentExamSlots(user.id);

    // For slots the student could currently enter, check their participation status
    const likelyCurrent = slots.filter((s) => {
      const now = Date.now();
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      return s.status === 'ongoing' || (s.status === 'scheduled' && now >= start && now <= end);
    });

    const participations: Record<string, ParticipationStatus> = {};
    await Promise.all(
      likelyCurrent.map(async (slot) => {
        try {
          const { items } = await fetchExamParticipations(slot.id, { pageSize: 100 });
          const mine = items.find((p) => p.studentId === user.id);
          // Ignore "Submitted" if student never actually started (BE bug: auto-created record)
          if (mine && !(mine.status === 'Submitted' && mine.actualStart === null)) {
            participations[slot.id] = mine.status;
          }
        } catch { /* ignore */ }
      }),
    );

    return { slots, participations };
  }, [user?.id]);

  const slots = data?.slots ?? [];
  const participations = data?.participations ?? {};

  const filtered = slots.filter((slot) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      slot.examName.toLowerCase().includes(q) ||
      slot.classCode.toLowerCase().includes(q) ||
      slot.className.toLowerCase().includes(q);
    const status = deriveStudentStatus(slot, participations[slot.id]);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  const handleStart = async (slot: ExamSlot) => {
    if (!user?.id || checkingId) return;
    setCheckingId(slot.id);
    try {
      const { items } = await fetchExamParticipations(slot.id, { pageSize: 100 });
      const mine = items.find((p) => p.studentId === user.id);
      // Only block if student actually started AND submitted (ignore BE auto-created records)
      if (mine?.status === 'Submitted' && mine.actualStart !== null) {
        toast.warning('Already submitted', 'You have already completed this exam and cannot retake it.');
        return;
      }
      if (mine?.status === 'Disqualified') {
        toast.error('Disqualified', 'You have been disqualified from this exam.');
        return;
      }
    } catch { /* if API fails, allow through */ }
    finally { setCheckingId(null); }
    localStorage.setItem(`studentExam_${slot.id}`, JSON.stringify(slot));
    navigate(`/student/exams/${slot.id}/verify`);
  };

  const counts = {
    total:     slots.length,
    available: slots.filter((s) => deriveStudentStatus(s, participations[s.id]) === 'available').length,
    upcoming:  slots.filter((s) => deriveStudentStatus(s, participations[s.id]) === 'upcoming').length,
    submitted: slots.filter((s) => deriveStudentStatus(s, participations[s.id]) === 'submitted').length,
    completed: slots.filter((s) => deriveStudentStatus(s, participations[s.id]) === 'completed').length,
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
          { label: 'Submitted', value: counts.submitted, color: 'text-cyan' },
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
        <div className="flex gap-2 flex-wrap">
          {(['all', 'available', 'upcoming', 'submitted', 'completed'] as const).map((s) => (
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
            const studentStatus = deriveStudentStatus(slot, participations[slot.id]);
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
                  onClick={() => canStart && void handleStart(slot)}
                  disabled={!canStart || checkingId === slot.id}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    canStart
                      ? 'bg-blue text-white border-blue hover:bg-blue/80 disabled:opacity-60 cursor-pointer'
                      : 'bg-transparent cursor-not-allowed ' + (
                          studentStatus === 'submitted'
                            ? 'text-cyan border-cyan/30'
                            : studentStatus === 'disqualified'
                              ? 'text-red border-red/30'
                              : studentStatus === 'completed'
                                ? 'text-muted border-border'
                                : studentStatus === 'missed'
                                  ? 'text-red border-red/30'
                                  : 'text-gold border-gold/30'
                        )
                  }`}
                >
                  {checkingId === slot.id
                    ? '⏳ Checking…'
                    : canStart
                      ? '🚀 Start Exam'
                      : studentStatus === 'submitted'
                        ? '✅ Submitted'
                        : studentStatus === 'disqualified'
                          ? '🚫 Disqualified'
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
