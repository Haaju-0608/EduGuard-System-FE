import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCalendar, FiClock } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchExamParticipations, fetchStudentExamSlots } from '../../../services/schoolAdminApi';
import type { ExamSlot } from '../../../types/lecturer';
import type { ParticipationStatus } from '../../../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────

type StudentStatus = 'available' | 'upcoming' | 'completed' | 'missed' | 'submitted' | 'disqualified';

function deriveStatus(slot: ExamSlot, participation?: ParticipationStatus): StudentStatus {
  if (participation === 'Submitted') return 'submitted';
  if (participation === 'Disqualified') return 'disqualified';
  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();
  if (slot.status === 'completed') return 'completed';
  if (slot.status === 'cancelled') return 'missed';
  if (slot.status === 'ongoing') return 'available';
  if (now < start) return 'upcoming';
  if (now <= end) return 'available';
  return 'missed';
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function ExamRow({
  slot,
  action,
}: {
  slot: ExamSlot;
  action: React.ReactNode;
}) {
  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-muted font-mono bg-navy border border-border px-2 py-0.5 rounded-full">
          {slot.classCode}
        </span>
        <h3 className="font-syne font-bold text-white-soft text-base mt-2 truncate">{slot.examName}</h3>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted flex-wrap">
          <span className="flex items-center gap-1"><FiCalendar className="text-cyan shrink-0" />{fmtDT(slot.startTime)}</span>
          <span className="flex items-center gap-1"><FiClock className="text-cyan shrink-0" />{slot.durationMinutes} min</span>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function StudentOverview() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const { data, loading } = useAsyncData(async () => {
    if (!user?.id) return { slots: [] as ExamSlot[], participations: {} as Record<string, ParticipationStatus> };

    const slots = await fetchStudentExamSlots(user.id);

    // Only check participation for currently-active slots
    const active = slots.filter((s) => {
      const now = Date.now();
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      return s.status === 'ongoing' || (s.status === 'scheduled' && now >= start && now <= end);
    });

    const participations: Record<string, ParticipationStatus> = {};
    await Promise.all(
      active.map(async (slot) => {
        try {
          const { items } = await fetchExamParticipations(slot.id, { pageSize: 100 });
          // Lọc thêm examSlotId ở FE vì BE hiện chưa filter theo examSlotId (trả về participation của mọi bài thi)
          const mine = items.find((p) => p.examSlotId === slot.id && p.studentId === user.id);
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

  const withStatus = slots.map((s) => ({
    ...s,
    _status: deriveStatus(s, participations[s.id]),
  }));

  const available    = withStatus.filter((s) => s._status === 'available').slice(0, 3);
  const upcoming     = withStatus.filter((s) => s._status === 'upcoming').slice(0, 3);
  const submitted    = withStatus.filter((s) => s._status === 'submitted' || s._status === 'completed');

  const counts = {
    total:     slots.length,
    available: withStatus.filter((s) => s._status === 'available').length,
    upcoming:  withStatus.filter((s) => s._status === 'upcoming').length,
    submitted: submitted.length,
  };

  const KPI_SKELETON = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-navy-card border border-border rounded-2xl p-4 animate-pulse">
          <div className="w-6 h-6 bg-white/5 rounded mb-3" />
          <div className="h-7 bg-white/5 rounded w-1/2 mb-1" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-blue/20 to-navy-card border border-blue/20 rounded-[20px] p-6">
        <p className="text-blue-bright font-semibold text-sm">{greeting} 👋</p>
        <h1 className="font-syne text-2xl font-extrabold text-white-soft mt-1">{user?.name ?? 'Student'}</h1>
        <p className="text-muted text-sm mt-1">Here's what's happening with your exams today.</p>
      </div>

      {/* KPI */}
      {loading ? KPI_SKELETON : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Exams', value: counts.total,     color: 'text-blue-bright', icon: '📝' },
            { label: 'Available',   value: counts.available, color: 'text-green',       icon: '🚀' },
            { label: 'Upcoming',    value: counts.upcoming,  color: 'text-gold',        icon: '⏳' },
            { label: 'Submitted',   value: counts.submitted, color: 'text-muted',       icon: '✅' },
          ].map((k) => (
            <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{k.icon}</span>
              </div>
              <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Available Now */}
      {!loading && available.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-bold text-white-soft text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
              Available Now
            </h2>
            <button
              onClick={() => navigate('/student/exams')}
              className="text-xs text-blue-bright flex items-center gap-1 cursor-pointer bg-transparent border-none hover:underline"
            >
              View all <FiArrowRight className="text-xs" />
            </button>
          </div>
          {available.map((exam) => (
            <ExamRow
              key={exam.id}
              slot={exam}
              action={
                <button
                  onClick={() => {
                    localStorage.setItem(`studentExam_${exam.id}`, JSON.stringify(exam));
                    navigate(`/student/exams/${exam.id}/verify`);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green text-white text-sm font-semibold cursor-pointer hover:bg-green/80 transition-colors border-none whitespace-nowrap"
                >
                  Start <FiArrowRight />
                </button>
              }
            />
          ))}
        </div>
      )}

      {/* Upcoming Exams */}
      {!loading && upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-syne font-bold text-white-soft text-base">Upcoming Exams</h2>
          {upcoming.map((exam) => (
            <ExamRow
              key={exam.id}
              slot={exam}
              action={
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gold bg-gold/10 border border-gold/25 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Upcoming
                </span>
              }
            />
          ))}
        </div>
      )}

      {/* Recently Submitted */}
      {!loading && submitted.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-syne font-bold text-white-soft text-base">Recently Submitted</h2>
          {submitted.slice(0, 3).map((exam) => (
            <ExamRow
              key={exam.id}
              slot={exam}
              action={
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan bg-cyan/10 border border-cyan/25 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan" /> Submitted
                </span>
              }
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && slots.length === 0 && (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📝</p>
          <p className="text-muted text-sm">No exams scheduled yet.</p>
        </div>
      )}
    </div>
  );
}
