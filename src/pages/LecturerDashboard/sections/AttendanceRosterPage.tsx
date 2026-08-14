import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiFilm,
  FiPlay,
  FiRefreshCw,
  FiStopCircle,
  FiUpload,
  FiUserPlus,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import {
  EmptyState,
  FilterPills,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionTitle,
  SkeletonCard,
  StudentAvatar,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import {
  deductAttendance,
  fetchClassById,
  fetchClassEnrollmentsWithStudents,
  fetchExamSlots,
  fetchWallet,
  sendAttendanceStartedEmail,
} from '../../../services/schoolAdminApi';
import {
  createAttendanceRecord,
  endAttendanceSession,
  fetchActiveAttendanceSession,
  fetchAttendanceRecordsByExam,
  fetchAttendanceSessionById,
  markAttendanceByAiVideo,
  startAttendanceSession,
  updateAttendanceRecord,
} from '../../../services/lecturerApi';
import { useAuth } from '../../../contexts/AuthContext';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, ExamSlot, LecturerClass } from '../../../types/lecturer';
import type { ApiEnrollment } from '../../../types/api';

type RosterStatus = AttendanceStatus | 'future';

// BE (08/08) chặn EndTime > ExamSlot.EndTime cho session gắn examSlotId — nếu bài thi đã hết giờ
// từ trước, phải gửi đúng giờ kết thúc bài thi làm EndTime thay vì "now" thật (sẽ luôn bị 400).
function computeEndTime(examEndTime: string | null | undefined): string {
  if (examEndTime && new Date(examEndTime).getTime() < Date.now()) return examEndTime;
  return new Date().toISOString();
}

// Manual catch-up chỉ cần Present/Absent — Late/Excused vẫn còn dùng cho record cũ/lịch sử (badge)
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
];

const ROSTER_PAGE_SIZE = 15;

async function notifyStudentsAttendanceStarted(classId: string, className: string) {
  try {
    const enrollments = await fetchClassEnrollmentsWithStudents(classId);
    const students = enrollments.map((e) => e.student).filter((s): s is NonNullable<typeof s> => !!s?.email);
    await Promise.all(
      students.map((s) =>
        sendAttendanceStartedEmail({ email: s.email, studentName: s.fullName?.trim() || s.email, className })
          .catch(() => undefined),
      ),
    );
  } catch {
    // Gửi mail thông báo là phụ — không throw ra ngoài.
  }
}

/** ExamSlot chưa được truyền qua route state (vd F5 / mở link thẳng) — tự tra lại bằng danh sách
 *  exam-slots đã map sẵn (không có endpoint "get 1 exam slot đã map" riêng). */
async function fetchExamSlotFallback(examId: string): Promise<ExamSlot | null> {
  const result = await fetchExamSlots({ page: 1, pageSize: 100 });
  return result.items.find((e) => e.id === examId) ?? null;
}

/** Badge trạng thái điểm danh trong phiên đang mở (chỉ 4 giá trị thật từ record) */
function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const config = {
    present: { label: 'Present', icon: FiCheckCircle, className: 'text-green bg-green/10 border-green/25' },
    absent: { label: 'Absent', icon: FiXCircle, className: 'text-red bg-red/10 border-red/25' },
    late: { label: 'Late', icon: FiClock, className: 'text-gold bg-gold/10 border-gold/25' },
    excused: { label: 'Excused', icon: FiCheckCircle, className: 'text-blue-bright bg-blue/10 border-blue/25' },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      <Icon className="text-xs" /> {label}
    </span>
  );
}

/** Badge trạng thái cho roster — Future = chưa điểm danh (bất kể bài thi đã bắt đầu hay chưa),
 *  Present/Absent/Late/Excused = đã có record thật sau khi điểm danh. */
function RosterStatusBadge({ status }: { status: RosterStatus }) {
  const config: Record<RosterStatus, { label: string; icon: typeof FiClock; className: string }> = {
    present: { label: 'Present', icon: FiCheckCircle, className: 'text-green bg-green/10 border-green/25' },
    absent: { label: 'Absent', icon: FiXCircle, className: 'text-red bg-red/10 border-red/25' },
    late: { label: 'Late', icon: FiClock, className: 'text-gold bg-gold/10 border-gold/25' },
    excused: { label: 'Excused', icon: FiCheckCircle, className: 'text-blue-bright bg-blue/10 border-blue/25' },
    future: { label: 'Future', icon: FiClock, className: 'text-muted bg-white/5 border-border' },
  };
  const { label, icon: Icon, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      <Icon className="text-xs" /> {label}
    </span>
  );
}

/** Thống kê phiên điểm danh — nhận `records` đã gộp (session đang mở + lịch sử session trước đó
 *  của cùng bài thi), KHÔNG dùng session.records trực tiếp — nếu không, số liệu sẽ về 0 ngay khi
 *  vừa mở lại 1 session mới cho bài thi đã từng điểm danh trước đó. */
function SessionStats({ records }: { records: AttendanceRecord[] }) {
  const presentCount = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const rate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

  const stats = [
    { label: 'Total Students', value: records.length, color: 'text-blue-bright', bg: 'bg-blue/10', icon: FiUsers },
    { label: 'Present', value: presentCount, color: 'text-green', bg: 'bg-green/10', icon: FiCheckCircle },
    { label: 'Absent', value: absentCount, color: 'text-red', bg: 'bg-red/10', icon: FiXCircle },
    { label: 'Attendance Rate', value: `${rate}%`, color: 'text-cyan', bg: 'bg-cyan/10', icon: FiClock },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className={`${s.bg} border border-border/50 rounded-2xl p-4 text-center`}>
          <s.icon className={`${s.color} mx-auto mb-2 text-lg`} />
          <p className={`font-syne font-extrabold text-2xl ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Xác nhận trước khi upload video AI. */
function AiVideoConfirmDialog({
  fileName, uploading, onConfirm, onCancel,
}: { fileName: string; uploading: boolean; onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center shrink-0">
            <FiFilm className="text-blue-bright" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-syne font-bold text-white-soft text-base">Scan Video & Mark Attendance?</h3>
            <p className="text-muted text-sm mt-1">
              AI will scan <span className="text-white-soft font-medium break-all">"{fileName}"</span>, match faces
              against approved biometric photos, and mark recognized students as Present.
            </p>
            <p className="text-gold text-xs mt-2">
              ℹ️ The session stays open after scanning — you can still manually mark anyone AI missed, then
              end the session yourself when you're done.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><span className="animate-spin">⏳</span> Processing…</>
            ) : (
              <><FiUpload size={14} /> Scan & Mark</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Roster điểm danh của 1 bài thi cụ thể — trước khi điểm danh: hiện trạng thái từng sinh viên
 *  (Future / Not Marked / Present / Absent...). Bấm "Start Attendance" để vào phiên điểm danh sống
 *  (AI video hoặc tay); phiên kết thúc (tay hoặc AI tự đóng) sẽ tự quay lại đúng trang roster này với
 *  trạng thái mới nhất — không cần điều hướng thủ công. */
export default function AttendanceRosterPage() {
  const { classId, examId } = useParams<{ classId: string; examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  const stateData = (location.state as { exam?: ExamSlot; cls?: LecturerClass } | null) ?? null;

  const [exam, setExam] = useState<ExamSlot | null>(stateData?.exam ?? null);
  const [cls, setCls] = useState<LecturerClass | null>(stateData?.cls ?? null);
  const [roster, setRoster] = useState<ApiEnrollment[]>([]);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [examRecords, setExamRecords] = useState<AttendanceRecord[]>([]);
  const [blockedSession, setBlockedSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [rosterPage, setRosterPage] = useState(1);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const sessionRef = useRef<AttendanceSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const reloadExamRecords = async () => {
    if (!classId || !examId) return;
    const records = await fetchAttendanceRecordsByExam(classId, examId).catch(() => []);
    setExamRecords(records);
  };

  const loadAll = async () => {
    if (!classId || !examId) return;
    setLoading(true);
    try {
      // examRecords luôn được nạp (không chỉ khi không có session active) — gộp record của MỌI
      // session từng mở cho bài thi này. Cần thiết vì 1 bài thi có thể được điểm danh qua nhiều
      // session khác nhau (vd session trước đã End, giờ mở session mới để điểm danh bù): nếu chỉ
      // dựa vào session.records (chỉ chứa record của riêng session đang mở), học sinh đã Present
      // từ session trước sẽ biến mất khỏi bảng Present và bị coi là "chưa điểm danh" một cách sai lệch.
      const [examData, clsData, rosterData, activeSession, historicalRecords] = await Promise.all([
        fetchExamSlotFallback(examId),
        fetchClassById(classId).catch(() => null),
        fetchClassEnrollmentsWithStudents(classId).catch(() => []),
        fetchActiveAttendanceSession(classId).catch(() => null),
        fetchAttendanceRecordsByExam(classId, examId).catch(() => []),
      ]);
      setExam(examData);
      setCls(clsData);
      setRoster(rosterData);
      setExamRecords(historicalRecords);

      if (activeSession && activeSession.examSlotId === examId) {
        setSession(activeSession);
        setBlockedSession(null);
      } else {
        setSession(null);
        setBlockedSession(activeSession);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, [classId, examId]);

  // Realtime: BE bắn AttendanceProgressChanged mỗi khi có 1 record mới (AI scan hoặc tay đánh dấu),
  // và AttendanceCompleted khi session tự đóng — trước đây trang này chỉ có nút Refresh tay, lecturer
  // phải tự bấm liên tục mới biết AI quét video xong tới đâu.
  const attendanceHub = useHubConnection(HubRoute.Attendance, !!session?.id);
  useHubGroup(HubRoute.Attendance, 'JoinAttendanceSession', session?.id ? [session.id] : null);
  useHubEvent(attendanceHub, 'AttendanceProgressChanged', () => {
    if (!session?.id) return;
    fetchAttendanceSessionById(session.id).then(setSession).catch(() => undefined);
  });
  useHubEvent(attendanceHub, 'AttendanceCompleted', () => {
    if (!session) return;
    toast.info('Session closed', 'The attendance session has ended.');
    setSession(null);
    void reloadExamRecords();
  });

  // Bắt kịp trường hợp bài thi hết giờ NGAY khi lecturer đang xem trang, không cần đợi Refresh —
  // giống cơ chế cũ nhưng chỉ cần theo dõi đúng 1 session của bài thi đang xem thay vì quét toàn bộ.
  useEffect(() => {
    const interval = setInterval(() => {
      const s = sessionRef.current;
      if (s?.examEndTime && new Date(s.examEndTime).getTime() < Date.now()) {
        endAttendanceSession(s.id, computeEndTime(s.examEndTime))
          .then(() => {
            setSession(null);
            toast.info('Session auto-closed', 'The exam time has ended.');
            void reloadExamRecords();
          })
          .catch(() => undefined);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [classId, examId]);

  const handleStartSession = async () => {
    if (!exam || !classId) return;
    setActionLoading(true);
    try {
      const newSession = await startAttendanceSession(classId, exam.id);
      setSession(newSession);
      setBlockedSession(null);
      toast.success('Attendance started', `${exam.examName} — ${exam.classCode} ${exam.className}`);
      void notifyStudentsAttendanceStarted(classId, exam.className);

      if (user?.institutionId) {
        try {
          const wallet = await fetchWallet(user.institutionId);
          await deductAttendance({
            walletId: wallet.id,
            attendanceSessionId: newSession.id,
            studentCount: newSession.totalStudents || 0,
          });
        } catch {
          toast.warning('Wallet', 'Could not deduct attendance credits from wallet.');
        }
      }
    } catch (err) {
      toast.error('Failed to open session', err instanceof Error ? err.message : 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await endAttendanceSession(session.id, computeEndTime(session.examEndTime));
      setSession(null);
      toast.info('Session ended', 'Attendance data has been saved.');
      void reloadExamRecords();
    } catch {
      toast.error('Failed to close session', 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!session) return;
    setMarkingId(studentId);
    try {
      await createAttendanceRecord(session.id, studentId, status);
      const refreshed = await fetchAttendanceSessionById(session.id);
      setSession(refreshed);
      toast.success('Marked', `Attendance recorded as ${status}.`);
    } catch (err) {
      toast.error('Failed to mark attendance', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setMarkingId(null);
    }
  };

  // Sửa lại record đã điểm danh nhầm (Present ↔ Absent) — BE cho sửa cả khi session đã kết thúc,
  // chỉ chặn khi session bị Cancelled. Record đang hiển thị có thể thuộc 1 session CŨ đã đóng (carry
  // qua từ session trước, xem effectiveRecords) chứ không nhất thiết thuộc session đang mở — nên
  // luôn refresh cả examRecords (không chỉ session hiện tại) để phản ánh đúng thay đổi dù sửa trên
  // record của session nào.
  const handleChangeStatus = async (record: AttendanceRecord, nextStatus: AttendanceStatus) => {
    setMarkingId(record.rawStudentId);
    try {
      await updateAttendanceRecord(record.id, nextStatus);
      await Promise.all([
        session ? fetchAttendanceSessionById(session.id).then(setSession) : Promise.resolve(),
        reloadExamRecords(),
      ]);
      toast.success('Updated', `Attendance changed to ${nextStatus}.`);
    } catch (err) {
      toast.error('Failed to update attendance', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPendingVideo(file);
    e.target.value = '';
  };

  // BE (commit f62273e, 09/08) không còn tự đóng session sau khi quét video nữa — session vẫn
  // InProgress, chỉ cần refresh lại đúng session này (thêm record mới) rồi ở nguyên màn hình sống để
  // giảng viên tự điểm danh bù/kiểm tra tiếp, tự bấm End Session khi xong (giống điểm danh tay).
  const handleConfirmAiVideo = async () => {
    if (!session || !pendingVideo) return;
    setUploadingVideo(true);
    try {
      const recognized = await markAttendanceByAiVideo(session.id, pendingVideo);
      toast.success(
        'Attendance marked by AI',
        `Recognized ${recognized.length} student${recognized.length !== 1 ? 's' : ''} as Present. Session is still open — mark anyone missed, then End Session when done.`,
      );
      const refreshed = await fetchAttendanceSessionById(session.id);
      setSession(refreshed);
    } catch (err) {
      toast.error('Failed to process video', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingVideo(false);
      setPendingVideo(null);
    }
  };

  // Gộp record của session đang mở (nếu có) LÊN TRÊN record lịch sử từ các session trước đó của
  // cùng bài thi — session đang mở luôn thắng vì mới nhất, nhưng học sinh chưa được điểm danh lại
  // trong session mới vẫn giữ nguyên trạng thái đã ghi nhận trước đó thay vì bị coi là "chưa điểm danh".
  const effectiveRecords: AttendanceRecord[] = (() => {
    const map = new Map(examRecords.map((r) => [r.rawStudentId, r]));
    if (session) {
      for (const r of session.records) map.set(r.rawStudentId, r);
    }
    return [...map.values()];
  })();

  const recordedStudentIds = new Set(effectiveRecords.map((r) => r.rawStudentId));
  const missingStudents = roster.filter((e) => e.student && !recordedStudentIds.has(e.studentId));

  const filteredRecords: AttendanceRecord[] = session
    ? filter === 'all' ? effectiveRecords : effectiveRecords.filter((r) => r.status === filter)
    : [];
  const presentRecords = filteredRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'excused');
  const absentRecords = filteredRecords.filter((r) => r.status === 'absent');
  const filterCounts = session ? {
    all: effectiveRecords.length,
    present: effectiveRecords.filter((r) => r.status === 'present').length,
    absent: effectiveRecords.filter((r) => r.status === 'absent').length,
  } : undefined;

  const recordByStudent = new Map(effectiveRecords.map((r) => [r.rawStudentId, r]));
  // Future = bài thi chưa tới giờ (chưa thể điểm danh). Ongoing/Completed mà chưa có record thật
  // (AI bỏ sót hoặc chưa điểm danh tay) → báo Absent ngay, không đợi giảng viên tự sửa mới thấy —
  // đây chỉ là suy luận hiển thị ở FE, không tạo record thật trong DB.
  const statusFor = (studentRawId: string): RosterStatus => {
    const rec = recordByStudent.get(studentRawId);
    if (rec) return rec.status;
    return exam?.status === 'scheduled' ? 'future' : 'absent';
  };

  const rosterTotalPages = Math.max(1, Math.ceil(roster.length / ROSTER_PAGE_SIZE));
  const safeRosterPage = Math.min(rosterPage, rosterTotalPages);
  const pagedRoster = roster.slice((safeRosterPage - 1) * ROSTER_PAGE_SIZE, safeRosterPage * ROSTER_PAGE_SIZE);

  const canStart = !!exam && exam.status === 'ongoing' && !blockedSession && !session;
  const startDisabledReason = !exam
    ? null
    : exam.status === 'scheduled'
      ? "This exam hasn't started yet."
      : exam.status === 'completed'
        ? 'This exam has already ended.'
        : exam.status === 'cancelled'
          ? 'This exam was cancelled.'
          : blockedSession
            ? `Another session is currently open for a different exam ("${blockedSession.examName ?? 'Unknown'}") in this class — end it first.`
            : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attendance"
        title={exam ? exam.examName : loading ? 'Loading…' : 'Exam not found'}
        subtitle={cls ? `${cls.code} · ${cls.name}` : 'Student attendance roster for this exam.'}
        facultyId={cls?.facultyId}
        actions={
          <div className="flex gap-2">
            <PrimaryButton variant="ghost" onClick={() => navigate(classId ? `/lecture/attendance/${classId}` : '/lecture/attendance')}>
              <FiArrowLeft /> Back to Exams
            </PrimaryButton>
            <PrimaryButton variant="ghost" onClick={loadAll} disabled={loading}>
              <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </PrimaryButton>
          </div>
        }
        stats={exam ? [
          { label: 'Status', value: exam.status.charAt(0).toUpperCase() + exam.status.slice(1), icon: '📌' },
          { label: 'Students', value: String(roster.length), icon: '👥' },
        ] : undefined}
      />

      {!session && (
        <UniCard accent="green" hover={false} className="!p-6">
          <SectionTitle
            icon={<FiUsers className="text-green" />}
            title="Start Attendance"
            subtitle="Start a live attendance session for this exam — mark students present via AI video scan or manually."
          />
          {!exam && !loading ? (
            <div className="flex items-center gap-3 bg-red/5 border border-red/20 rounded-xl px-4 py-3 text-sm text-red">
              <span className="text-lg">⚠️</span>
              <span>Could not find this exam.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <PrimaryButton variant="success" onClick={handleStartSession} disabled={!canStart || actionLoading}>
                <FiPlay /> {actionLoading ? 'Starting...' : 'Start Attendance Session'}
              </PrimaryButton>
              {startDisabledReason && (
                <p className="text-[11px] text-muted">{startDisabledReason}</p>
              )}
            </div>
          )}
        </UniCard>
      )}

      {session && (
        <UniCard accent="green" hover={false} className="!p-6">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="flex items-center gap-1.5 text-xs text-green font-bold bg-green/10 border border-green/25 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green rounded-full animate-pulse" /> Active Session
            </span>
            <span className="course-code-badge text-xs">{session.classCode}</span>
            <span className="text-sm text-white-soft font-semibold">{session.className}</span>
            {session.examName && (
              <span className="text-xs font-semibold text-gold bg-gold/10 border border-gold/25 px-2.5 py-1 rounded-full">
                📝 {session.examName}
              </span>
            )}
            <span className="text-xs text-muted">🕐 {session.startTime}</span>
            <PrimaryButton variant="danger" onClick={handleEndSession} disabled={actionLoading} className="ml-auto">
              <FiStopCircle /> {actionLoading ? 'Ending...' : 'End Session'}
            </PrimaryButton>
          </div>

          <SessionStats records={effectiveRecords} />

          <div className="mt-6 pt-6 border-t border-border/60">
            <SectionTitle
              icon={<FiFilm className="text-blue-bright" />}
              title="AI Video Attendance"
              subtitle="Upload a classroom video — AI will recognize enrolled students by face and mark them Present. This will end the session once processing finishes."
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoSelected}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue/30 text-blue-bright text-sm font-semibold cursor-pointer hover:bg-blue/10 transition-all disabled:opacity-50 bg-transparent"
              >
                <FiUpload size={14} /> Choose Video File
              </button>
              {pendingVideo && !uploadingVideo && (
                <span className="text-xs text-muted truncate max-w-[240px]">📎 {pendingVideo.name}</span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/60">
            <SectionTitle
              icon={<FiUserPlus className="text-gold" />}
              title="Add Manual Attendance"
              subtitle="Students below have no attendance record yet for this session — mark them manually if AI missed them."
            />

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : missingStudents.length === 0 ? (
              <p className="text-sm text-muted">
                {roster.length === 0 ? 'No enrolled students found for this class.' : 'Every enrolled student already has an attendance record. 🎉'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                {missingStudents.map((e) => {
                  const name = e.student?.fullName?.trim() || e.student?.email || 'Unknown student';
                  const isBusy = markingId === e.studentId;
                  return (
                    <div key={e.studentId} className="roster-item">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                        <p className="text-[10px] text-muted font-mono">{e.student?.studentCode ?? e.studentId.slice(0, 8)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => void handleMarkAttendance(e.studentId, opt.value)}
                            disabled={isBusy}
                            title={`Mark ${opt.label}`}
                            className="px-2.5 py-1.5 rounded-lg border border-border text-[10px] font-bold text-muted hover:text-white-soft hover:border-blue-bright/40 transition-all cursor-pointer bg-transparent disabled:opacity-40"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </UniCard>
      )}

      {session && (
        <>
          <FilterPills
            tabs={[
              { key: 'all', label: 'All' },
              { key: 'present', label: 'Present' },
              { key: 'absent', label: 'Absent' },
            ]}
            active={filter}
            onChange={setFilter}
            counts={filterCounts}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="roster-panel roster-panel-present">
              <h2 className="font-syne font-bold text-white-soft mb-4 flex items-center gap-2">
                <FiCheckCircle className="text-green text-lg" />
                Present List
                <span className="text-sm font-normal text-muted">({presentRecords.length})</span>
              </h2>
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                {presentRecords.length === 0 ? (
                  <p className="text-muted text-sm text-center py-8">No students yet</p>
                ) : (
                  presentRecords.map((record, i) => (
                    <div key={record.id} className="roster-item animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <StudentAvatar initials={record.initials} size="sm" variant="present" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white-soft truncate">{record.name}</p>
                          <p className="text-[10px] text-muted font-mono">{record.studentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <AttendanceBadge status={record.status} />
                          {record.checkInTime && <p className="text-[10px] text-muted mt-1">{record.checkInTime}</p>}
                        </div>
                        <button
                          onClick={() => void handleChangeStatus(record, 'absent')}
                          disabled={markingId === record.rawStudentId}
                          title="Mark as Absent instead"
                          className="px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-muted hover:text-red hover:border-red/40 transition-all cursor-pointer bg-transparent disabled:opacity-40"
                        >
                          → Absent
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="roster-panel roster-panel-absent">
              <h2 className="font-syne font-bold text-white-soft mb-4 flex items-center gap-2">
                <FiXCircle className="text-red text-lg" />
                Absent List
                <span className="text-sm font-normal text-muted">({absentRecords.length})</span>
              </h2>
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                {absentRecords.length === 0 ? (
                  <p className="text-muted text-sm text-center py-8">All students are present 🎉</p>
                ) : (
                  absentRecords.map((record, i) => (
                    <div key={record.id} className="roster-item animate-stagger-in" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <StudentAvatar initials={record.initials} size="sm" variant="absent" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white-soft truncate">{record.name}</p>
                          <p className="text-[10px] text-muted font-mono">{record.studentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <AttendanceBadge status={record.status} />
                        <button
                          onClick={() => void handleChangeStatus(record, 'present')}
                          disabled={markingId === record.rawStudentId}
                          title="Mark as Present instead"
                          className="px-2 py-1 rounded-lg border border-border text-[10px] font-bold text-muted hover:text-green hover:border-green/40 transition-all cursor-pointer bg-transparent disabled:opacity-40"
                        >
                          → Present
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!session && (
        <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-white-soft">Student Roster</p>
            <span className="text-xs text-muted">{roster.length} student{roster.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} className="h-14" />)}
            </div>
          ) : roster.length === 0 ? (
            <EmptyState icon="👥" title="No enrolled students" description="This class has no enrolled students." />
          ) : (
            <div className="divide-y divide-border/50">
              {pagedRoster.map((e) => {
                const name = e.student?.fullName?.trim() || e.student?.email || 'Unknown';
                return (
                  <div key={e.studentId} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {e.student?.studentCode && <span className="text-[10px] font-mono text-muted">{e.student.studentCode}</span>}
                        {e.student?.email && <span className="text-[10px] text-muted truncate">{e.student.email}</span>}
                      </div>
                    </div>
                    <RosterStatusBadge status={statusFor(e.studentId)} />
                  </div>
                );
              })}
            </div>
          )}
          {!loading && roster.length > 0 && (
            <Pagination page={safeRosterPage} totalPages={rosterTotalPages} onChange={setRosterPage} className="px-5 py-3.5 border-t border-border" />
          )}
        </div>
      )}

      {pendingVideo && (
        <AiVideoConfirmDialog
          fileName={pendingVideo.name}
          uploading={uploadingVideo}
          onConfirm={() => void handleConfirmAiVideo()}
          onCancel={() => setPendingVideo(null)}
        />
      )}
    </PageShell>
  );
}
