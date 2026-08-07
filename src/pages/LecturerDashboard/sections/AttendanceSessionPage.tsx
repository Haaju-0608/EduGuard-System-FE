import React, { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiFolder,
  FiPlay,
  FiRefreshCw,
  FiStopCircle,
  FiUserPlus,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import {
  EmptyState,
  FilterPills,
  PageHeader,
  PageShell,
  PrimaryButton,
  SectionTitle,
  StudentAvatar,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import {
  deductAttendance,
  fetchClassEnrollmentsWithStudents,
  fetchExamSlots,
  fetchWallet,
  sendAttendanceStartedEmail,
} from '../../../services/schoolAdminApi';
import {
  createAttendanceRecord,
  endAttendanceSession,
  fetchActiveAttendanceSession,
  fetchAttendanceSessionById,
  fetchMyOpenAttendanceSessions,
  startAttendanceSession,
  type OpenSessionSummary,
} from '../../../services/lecturerApi';
import { useAuth } from '../../../contexts/AuthContext';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, ExamSlot } from '../../../types/lecturer';
import type { ApiEnrollment } from '../../../types/api';

// BE (08/08) chặn EndTime > ExamSlot.EndTime cho session gắn examSlotId — nếu bài thi đã hết giờ
// từ trước, phải gửi đúng giờ kết thúc bài thi làm EndTime thay vì "now" thật (sẽ luôn bị 400).
function computeEndTime(examEndTime: string | null | undefined): string {
  if (examEndTime && new Date(examEndTime).getTime() < Date.now()) return examEndTime;
  return new Date().toISOString();
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
  { value: 'absent', label: 'Absent' },
];

/** Báo mail "attendance-started" cho toàn bộ sinh viên trong lớp — chạy nền, không chặn UI và
 *  không làm hỏng flow mở điểm danh nếu gửi mail lỗi. */
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

/** Badge trạng thái điểm danh */
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

/** Thống kê phiên điểm danh */
function SessionStats({ session }: { session: AttendanceSession }) {
  const presentCount = session.records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentCount = session.records.filter((r) => r.status === 'absent').length;
  const rate = session.records.length > 0 ? Math.round((presentCount / session.records.length) * 100) : 0;

  const stats = [
    { label: 'Total Students', value: session.records.length, color: 'text-blue-bright', bg: 'bg-blue/10', icon: FiUsers },
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

/** Màn hình phiên điểm danh */
export default function AttendanceSessionPage() {
  const { user } = useAuth();
  // Điểm danh giờ đi theo BÀI THI (không phải chọn lớp trực tiếp): lecturer chọn 1 exam slot mình
  // được phân công coi thi (proctor), trang tự suy ra lớp + danh sách sinh viên của bài thi đó.
  const [exams, setExams] = useState<ExamSlot[]>([]);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all');
  const toast = useToast();

  // Danh sách sinh viên của lớp đang điểm danh — dùng để tìm ai chưa có record nào (AI trên app
  // mobile bỏ sót, hoặc chưa dùng AI) để giảng viên tự điểm danh tay bù vào.
  const [roster, setRoster] = useState<ApiEnrollment[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Toàn bộ session mình từng mở mà quên End — hệ thống không tự đóng theo giờ ca thi, nên các
  // session "mồ côi" này có thể tồn tại vô thời hạn nếu không dọn tay.
  const [openSessions, setOpenSessions] = useState<OpenSessionSummary[]>([]);
  const [loadingOpenSessions, setLoadingOpenSessions] = useState(false);
  const [endingOpenId, setEndingOpenId] = useState<string | null>(null);

  // Đọc được session hiện tại mới nhất bên trong interval mà không cần restart interval mỗi lần
  // session đổi (tránh setInterval bị tạo lại liên tục / đọc phải giá trị session cũ).
  const sessionRef = React.useRef<AttendanceSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  /** Tải lại danh sách session đang mở, đồng thời TỰ ĐỘNG đóng session nào có bài thi đã hết giờ —
   *  hệ thống (BE) không tự làm việc này, nên FE chủ động làm mỗi khi trang được load/refresh, và
   *  định kỳ (xem interval bên dưới) trong lúc trang vẫn đang mở. Không thể đảm bảo đóng được nếu
   *  không có ai mở trang này cả — trường hợp đó cần BE chạy job nền theo lịch. */
  const loadOpenSessions = async () => {
    if (!user?.id) return;
    setLoadingOpenSessions(true);
    try {
      const list = await fetchMyOpenAttendanceSessions(user.id);
      const now = Date.now();
      const expired = list.filter((s) => s.examEndTime && new Date(s.examEndTime).getTime() < now);

      if (expired.length > 0) {
        await Promise.all(expired.map((s) => endAttendanceSession(s.id, computeEndTime(s.examEndTime)).catch(() => undefined)));
        const expiredIds = new Set(expired.map((s) => s.id));
        if (sessionRef.current && expiredIds.has(sessionRef.current.id)) {
          setSession(null);
          toast.info('Session auto-closed', 'The exam time has ended.');
        }
        setOpenSessions(list.filter((s) => !expiredIds.has(s.id)));
      } else {
        setOpenSessions(list);
      }
    } catch {
      setOpenSessions([]);
    } finally {
      setLoadingOpenSessions(false);
    }
  };

  // Kiểm tra định kỳ trong lúc trang đang mở — bắt kịp trường hợp hết giờ thi NGAY khi lecturer
  // đang xem trang, không cần đợi họ bấm Refresh hay tải lại trang.
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => { void loadOpenSessions(); }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleEndOpenSession = async (id: string) => {
    setEndingOpenId(id);
    try {
      const target = openSessions.find((s) => s.id === id);
      await endAttendanceSession(id, computeEndTime(target?.examEndTime));
      if (session?.id === id) setSession(null);
      toast.success('Session ended', 'Closed successfully.');
      await loadOpenSessions();
    } catch {
      toast.error('Failed to close session', 'Please try again in a few seconds.');
    } finally {
      setEndingOpenId(null);
    }
  };

  useEffect(() => {
    if (!session) { setRoster([]); return; }
    setLoadingRoster(true);
    fetchClassEnrollmentsWithStudents(session.classId)
      .then(setRoster)
      .catch(() => setRoster([]))
      .finally(() => setLoadingRoster(false));
  }, [session?.id, session?.classId]);

  /** Tải danh sách bài thi mình coi thi (proctor) và phiên điểm danh hiện tại */
  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionData, examSlotsRes] = await Promise.all([
        fetchActiveAttendanceSession().catch(() => null),
        fetchExamSlots({ page: 1, pageSize: 100 }).catch(() => ({ items: [] as ExamSlot[], pagination: undefined })),
      ]);
      // Chỉ hiện bài thi mình được phân công proctor, ĐANG Ongoing — BE (08/08) giờ chặn cứng
      // không cho mở session điểm danh nếu giờ hiện tại chưa nằm trong [ExamSlot.StartTime,
      // ExamSlot.EndTime], nên bài "Scheduled" (chưa tới giờ) chọn vào cũng chắc chắn bị từ chối
      // lúc bấm Start — ẩn hẳn khỏi dropdown thay vì để bấm xong mới báo lỗi.
      const myExams = examSlotsRes.items.filter(
        (e) => e.proctorId === user?.id && e.status === 'ongoing',
      );
      setExams(myExams);
      setSession(sessionData);
      if (sessionData) setSelectedExamId(sessionData.examSlotId ?? '');
      else if (myExams.length > 0) setSelectedExamId(myExams[0].id);
    } catch {
      // exams failed to load — page still renders empty state
    } finally {
      setLoading(false);
    }
    void loadOpenSessions();
  };

  useEffect(() => { loadData(); }, []);

  /** Mở phiên điểm danh mới cho bài thi đã chọn + deduct wallet nếu có institutionId */
  const handleStartSession = async () => {
    const exam = exams.find((e) => e.id === selectedExamId);
    if (!exam) {
      toast.warning('No exam selected', 'Please select an exam before starting attendance.');
      return;
    }
    setActionLoading(true);
    try {
      const newSession = await startAttendanceSession(exam.classId, exam.id);
      setSession(newSession);
      toast.success('Attendance started', `${exam.examName} — ${exam.classCode} ${exam.className}`);
      void notifyStudentsAttendanceStarted(exam.classId, exam.className);
      void loadOpenSessions();

      // Deduct wallet credits nếu institution có wallet
      if (user?.institutionId) {
        try {
          const wallet = await fetchWallet(user.institutionId);
          await deductAttendance({
            walletId: wallet.id,
            attendanceSessionId: newSession.id,
            studentCount: newSession.totalStudents || 0,
          });
        } catch {
          // Không block UI nếu deduct thất bại
          toast.warning('Wallet', 'Could not deduct attendance credits from wallet.');
        }
      }
    } catch (err) {
      // Lecturer chỉ coi thi (proctor) nhưng không sở hữu lớp (không phải lecturerId của Class) sẽ
      // bị BE từ chối ở đây ("You can only open sessions for your own classes.") — hạn chế phía BE,
      // không phải bug FE, hiện thẳng message thật để biết chính xác lý do thay vì "try again" chung chung.
      toast.error('Failed to open session', err instanceof Error ? err.message : 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

  /** Đóng phiên điểm danh */
  const handleEndSession = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await endAttendanceSession(session.id, computeEndTime(session.examEndTime));
      setSession(null);
      toast.info('Session ended', 'Attendance data has been saved.');
      void loadOpenSessions();
    } catch {
      toast.error('Failed to close session', 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

  /** Điểm danh tay cho 1 sinh viên bị bỏ sót (chưa có record nào trong session) */
  const handleMarkAttendance = async (studentId: string, status: AttendanceStatus) => {
    if (!session) return;
    setMarkingId(studentId);
    try {
      await createAttendanceRecord(session.id, studentId, status);
      // Refresh đúng session này theo ID — không dò lại "active session của classId", vì nếu có
      // nhiều session cùng mở cho 1 lớp (quên End Session ở lần trước), dò theo classId có thể
      // trả về session KHÁC với session đang hiển thị, khiến record vừa tạo "biến mất" trên UI.
      const refreshed = await fetchAttendanceSessionById(session.id);
      setSession(refreshed);
      toast.success('Marked', `Attendance recorded as ${status}.`);
    } catch (err) {
      toast.error('Failed to mark attendance', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setMarkingId(null);
    }
  };

  const recordedStudentIds = new Set((session?.records ?? []).map((r) => r.rawStudentId));
  const missingStudents = roster.filter(
    (e) => e.student && !recordedStudentIds.has(e.studentId),
  );

  const filteredRecords: AttendanceRecord[] = session
    ? filter === 'all' ? session.records : session.records.filter((r) => r.status === filter)
    : [];

  const presentRecords = filteredRecords.filter((r) => r.status === 'present' || r.status === 'late' || r.status === 'excused');
  const absentRecords = filteredRecords.filter((r) => r.status === 'absent');

  const filterCounts = session ? {
    all: session.records.length,
    present: session.records.filter((r) => r.status === 'present').length,
    absent: session.records.filter((r) => r.status === 'absent').length,
    late: session.records.filter((r) => r.status === 'late').length,
    excused: session.records.filter((r) => r.status === 'excused').length,
  } : undefined;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attendance Session"
        title="Attendance Session"
        subtitle="Open attendance sessions for exams you're proctoring and track student presence in real time."
        actions={
          <PrimaryButton variant="ghost" onClick={loadData} disabled={loading}>
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </PrimaryButton>
        }
      />

      <UniCard accent="green" hover={false} className="!p-6">
        <SectionTitle
          icon={<FiUsers className="text-green" />}
          title="Session Control"
          subtitle="Select an exam you're proctoring and start attendance"
        />

        {exams.length === 0 && !loading ? (
          <div className="flex items-center gap-3 bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 text-sm text-gold">
            <span className="text-lg">⚠️</span>
            <span>You are not assigned as proctor for any currently ongoing exam. Attendance can only be opened while the exam is in progress.</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Exam</label>
              <CustomSelect
                value={selectedExamId}
                onChange={setSelectedExamId}
                disabled={!!session || exams.length === 0}
                options={exams.length === 0
                  ? [{value:'', label:'— No exams available —'}]
                  : exams.map((e) => ({
                      value: e.id,
                      label: `${e.examName} — ${e.classCode} ${e.className} (Ongoing)`,
                    }))
                }
              />
              {session && (
                <p className="text-[11px] text-muted mt-1.5">
                  Locked while a session is active — click "End Session" to switch to another exam.
                </p>
              )}
            </div>

            {!session ? (
              <PrimaryButton variant="success" onClick={handleStartSession} disabled={actionLoading || !selectedExamId || exams.length === 0}>
                <FiPlay /> {actionLoading ? 'Starting...' : 'Start Attendance Session'}
              </PrimaryButton>
            ) : (
              <PrimaryButton variant="danger" onClick={handleEndSession} disabled={actionLoading}>
                <FiStopCircle /> {actionLoading ? 'Ending...' : 'End Session'}
              </PrimaryButton>
            )}
          </div>
        )}

        {session && (
          <div className="mt-6 pt-6 border-t border-border/60">
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
              <span className="text-xs text-muted">📍 Room {session.room} · 🕐 {session.startTime}</span>
            </div>
            <SessionStats session={session} />

            {/* Điểm danh tay bù cho sinh viên chưa có record — điểm danh chính bằng AI thực hiện
                trên app di động, web chỉ xem kết quả + bù thủ công cho ai bị bỏ sót. */}
            <div className="mt-6 pt-6 border-t border-border/60">
              <SectionTitle
                icon={<FiUserPlus className="text-gold" />}
                title="Add Manual Attendance"
                subtitle="Students below have no attendance record yet for this session — mark them manually if the mobile app missed them."
              />

              {loadingRoster ? (
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
          </div>
        )}
      </UniCard>

      {/* Hệ thống không tự đóng session theo giờ ca thi hết hạn — panel này cho thấy hết mọi
          session mình từng mở mà quên End, để dọn tay thay vì chỉ thấy được 1 cái "mới nhất". */}
      {!loadingOpenSessions && openSessions.length > 0 && (
        <UniCard accent="gold" hover={false} className="!p-6">
          <SectionTitle
            icon={<FiFolder className="text-gold" />}
            title={`Open Sessions (${openSessions.length})`}
            subtitle="Sessions linked to an exam auto-close once the exam ends while this page is open. Sessions without a linked exam (or closed while you were away) need ending manually."
          />
          <div className="space-y-2 mt-4">
            {openSessions.map((s) => {
              const isCurrent = s.id === session?.id;
              const isEnding = endingOpenId === s.id;
              return (
                <div key={s.id} className="roster-item">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="course-code-badge text-xs">{s.classCode}</span>
                      <span className="text-sm font-semibold text-white-soft">{s.className}</span>
                      {s.examName && (
                        <span className="text-[10px] font-semibold text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
                          📝 {s.examName}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-semibold text-green bg-green/10 border border-green/25 px-2 py-0.5 rounded-full">
                          Currently shown above
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-0.5">
                      Opened {new Date(s.startTime).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleEndOpenSession(s.id)}
                    disabled={isEnding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red/30 text-red text-xs font-semibold cursor-pointer hover:bg-red/10 transition-colors disabled:opacity-40 bg-transparent shrink-0"
                  >
                    <FiStopCircle className="text-xs" /> {isEnding ? 'Ending...' : 'End'}
                  </button>
                </div>
              );
            })}
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
              { key: 'late', label: 'Late' },
              { key: 'excused', label: 'Excused' },
            ]}
            active={filter}
            onChange={setFilter}
            counts={filterCounts}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Có mặt */}
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
                    <div
                      key={record.id}
                      className="roster-item animate-stagger-in"
                      style={{ animationDelay: `${i * 0.06}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <StudentAvatar initials={record.initials} size="sm" variant="present" />
                        <div>
                          <p className="text-sm font-semibold text-white-soft">{record.name}</p>
                          <p className="text-[10px] text-muted font-mono">{record.studentId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <AttendanceBadge status={record.status} />
                        {record.checkInTime && <p className="text-[10px] text-muted mt-1">{record.checkInTime}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Vắng */}
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
                    <div
                      key={record.id}
                      className="roster-item animate-stagger-in"
                      style={{ animationDelay: `${i * 0.06}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <StudentAvatar initials={record.initials} size="sm" variant="absent" />
                        <div>
                          <p className="text-sm font-semibold text-white-soft">{record.name}</p>
                          <p className="text-[10px] text-muted font-mono">{record.studentId}</p>
                        </div>
                      </div>
                      <AttendanceBadge status={record.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {!session && !loading && (
        <EmptyState
          icon="📋"
          title="No Active Attendance Session"
          description='Select an exam above and click "Start Attendance Session" to begin.'
        />
      )}
    </PageShell>
  );
}
