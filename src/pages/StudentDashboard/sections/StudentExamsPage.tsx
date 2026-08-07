import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchExamParticipations,
  fetchMyExamAttendanceStatus,
  fetchStudentExamRecords,
  fetchStudentExamSlots,
  type StudentAttendanceRecord,
} from '../../../services/schoolAdminApi';
import { useToast } from '../../../contexts/ToastContext';
import type { ExamSlot } from '../../../types/lecturer';
import type { ApiStudentExamRecord, ParticipationStatus } from '../../../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────

type StudentStatus = 'upcoming' | 'available' | 'no-attendance' | 'missed' | 'submitted' | 'disqualified';

/** Lấy maxScore đã lưu kèm trong examRecord (JSON) lúc BE chấm điểm — tránh phải gọi thêm API câu hỏi */
function extractMaxScore(examRecord: string | null): number | null {
  if (!examRecord) return null;
  try {
    const parsed = JSON.parse(examRecord) as { maxScore?: number };
    return typeof parsed.maxScore === 'number' ? parsed.maxScore : null;
  } catch { return null; }
}

function deriveStudentStatus(
  slot: ExamSlot,
  participationStatus: ParticipationStatus | undefined,
  hasRecord: boolean,
  attendanceStatus: StudentAttendanceRecord['status'] | undefined,
): StudentStatus {
  // Có StudentExamRecord (đã nộp bài, BE đã chấm) hoặc participation Submitted → coi là đã nộp
  if (hasRecord || participationStatus === 'Submitted') return 'submitted';
  if (participationStatus === 'Disqualified') return 'disqualified';

  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();

  // slot.status === 'completed' chỉ nghĩa là giờ thi đã hết, KHÔNG phải sinh viên đã hoàn thành —
  // không có record/participation nghĩa là họ không thi, phải tính là "missed" (Absent).
  if (slot.status === 'completed') return 'missed';
  if (slot.status === 'cancelled') return 'missed';

  // Phải được lecturer điểm danh Present/Late trước mới cho vào thi — đây là gate ở FE, chặn thật
  // cần BE (ExamWorkflowService.JoinAsync hiện chưa kiểm tra điều kiện này, đã báo Giang).
  const isCheckedIn = attendanceStatus === 'present' || attendanceStatus === 'late';
  if (slot.status === 'ongoing') return isCheckedIn ? 'available' : 'no-attendance';
  // scheduled: derive from time
  if (now < start) return 'upcoming';
  if (now <= end) return isCheckedIn ? 'available' : 'no-attendance';
  return 'missed';
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; cls: string; dot: string }> = {
  available:      { label: 'Available',           cls: 'text-green bg-green/10 border-green/25',    dot: 'bg-green animate-pulse' },
  upcoming:       { label: 'Upcoming',             cls: 'text-gold bg-gold/10 border-gold/25',        dot: 'bg-gold' },
  'no-attendance': { label: 'Awaiting Attendance', cls: 'text-gold bg-gold/10 border-gold/25',        dot: 'bg-gold animate-pulse' },
  missed:         { label: 'Absent',               cls: 'text-red bg-red/10 border-red/25',           dot: 'bg-red' },
  submitted:      { label: 'Submitted',            cls: 'text-cyan bg-cyan/10 border-cyan/25',        dot: 'bg-cyan' },
  disqualified:   { label: 'Disqualified',         cls: 'text-red bg-red/10 border-red/25',           dot: 'bg-red' },
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
    if (!user?.id) {
      return {
        slots: [], participations: {} as Record<string, ParticipationStatus>,
        records: {} as Record<string, ApiStudentExamRecord>,
        attendance: {} as Record<string, StudentAttendanceRecord['status']>,
      };
    }
    const slots = await fetchStudentExamSlots(user.id);
    const attendance = await fetchMyExamAttendanceStatus(user.id).catch(() => ({} as Record<string, StudentAttendanceRecord['status']>));

    // StudentExamRecord tồn tại = đã nộp bài và được BE chấm điểm — nguồn xác định "submitted" đáng tin nhất
    const records: Record<string, ApiStudentExamRecord> = {};
    try {
      const { items } = await fetchStudentExamRecords({ studentId: user.id, pageSize: 200 });
      items.forEach((r) => { records[r.examSlotId] = r; });
    } catch { /* ignore */ }

    // For slots the student could currently enter, check their participation status (dùng để phát hiện Disqualified)
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
          // Lọc thêm examSlotId ở FE vì BE hiện chưa filter theo examSlotId (trả về participation của mọi bài thi)
          const mine = items.find((p) => p.examSlotId === slot.id && p.studentId === user.id);
          // Ignore "Submitted" if student never actually started (BE bug: auto-created record)
          if (mine && !(mine.status === 'Submitted' && mine.actualStart === null)) {
            participations[slot.id] = mine.status;
          }
        } catch { /* ignore */ }
      }),
    );

    return { slots, participations, records, attendance };
  }, [user?.id]);

  const slots = data?.slots ?? [];
  const participations = data?.participations ?? {};
  const records = data?.records ?? {};
  const attendance = data?.attendance ?? {};

  const filtered = slots.filter((slot) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      slot.examName.toLowerCase().includes(q) ||
      slot.classCode.toLowerCase().includes(q) ||
      slot.className.toLowerCase().includes(q);
    const status = deriveStudentStatus(slot, participations[slot.id], !!records[slot.id], attendance[slot.id]);
    const matchFilter = filter === 'all' || status === filter;
    return matchSearch && matchFilter;
  });

  const handleStart = async (slot: ExamSlot) => {
    if (!user?.id || checkingId) return;
    // Chặn lại lần nữa ở đây (ngoài việc nút đã disabled) — phòng khi attendance vừa đổi giữa lúc
    // trang đang mở. Chặn thật vẫn cần BE (JoinAsync chưa kiểm tra điều kiện này).
    const att = attendance[slot.id];
    if (att !== 'present' && att !== 'late') {
      toast.warning('Attendance required', 'You must be marked present by your proctor before starting this exam.');
      return;
    }
    setCheckingId(slot.id);
    try {
      if (records[slot.id]) {
        toast.warning('Already submitted', 'You have already completed this exam and cannot retake it.');
        return;
      }
      const { items } = await fetchExamParticipations(slot.id, { pageSize: 100 });
      const mine = items.find((p) => p.examSlotId === slot.id && p.studentId === user.id);
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

  const statusOf = (s: ExamSlot) => deriveStudentStatus(s, participations[s.id], !!records[s.id], attendance[s.id]);
  const counts = {
    total:     slots.length,
    available: slots.filter((s) => statusOf(s) === 'available').length,
    upcoming:  slots.filter((s) => statusOf(s) === 'upcoming').length,
    submitted: slots.filter((s) => statusOf(s) === 'submitted').length,
    missed:    slots.filter((s) => statusOf(s) === 'missed').length,
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
          {(['all', 'available', 'no-attendance', 'upcoming', 'submitted', 'missed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                filter === s
                  ? 'bg-blue text-white border-blue'
                  : 'bg-transparent text-muted border-border hover:border-blue/40'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
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
            const record = records[slot.id];
            const studentStatus = deriveStudentStatus(slot, participations[slot.id], !!record, attendance[slot.id]);
            const cfg = STATUS_CONFIG[studentStatus];
            const canStart = studentStatus === 'available';
            const maxScore = record ? extractMaxScore(record.examRecord) : null;
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
                  {record && record.finalScore != null && (
                    <div className="flex items-center gap-2 text-xs bg-cyan/10 border border-cyan/25 rounded-xl px-3 py-2">
                      <span className="text-cyan font-bold">🏆 Score: {record.finalScore}{maxScore != null ? `/${maxScore}` : ''}</span>
                    </div>
                  )}
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
                          : studentStatus === 'missed'
                            ? '❌ Absent'
                            : studentStatus === 'no-attendance'
                              ? '🙋 Waiting for Attendance'
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
