import React, { useEffect, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiPlay,
  FiRefreshCw,
  FiStopCircle,
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
  fetchSchoolAdminClassesSimple,
  fetchWallet,
  sendAttendanceStartedEmail,
} from '../../../services/schoolAdminApi';
import {
  endAttendanceSession,
  fetchActiveAttendanceSession,
  startAttendanceSession,
} from '../../../services/lecturerApi';
import { useAuth } from '../../../contexts/AuthContext';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, LecturerClass } from '../../../types/lecturer';

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
  const [classes, setClasses] = useState<LecturerClass[]>([]);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all');
  const toast = useToast();

  /** Tải danh sách lớp và phiên điểm danh hiện tại */
  const loadData = async () => {
    setLoading(true);
    try {
      const [classData, sessionData] = await Promise.all([
        fetchSchoolAdminClassesSimple(),
        fetchActiveAttendanceSession().catch(() => null),
      ]);
      setClasses(classData.filter((c) => c.status === 'active'));
      setSession(sessionData);
      if (sessionData) setSelectedClassId(sessionData.classId);
      else if (classData.length > 0) setSelectedClassId(classData[0].id);
    } catch {
      // classes failed to load — page still renders empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  /** Mở phiên điểm danh mới + deduct wallet nếu có institutionId */
  const handleStartSession = async () => {
    if (!selectedClassId) {
      toast.warning('No class selected', 'Please select a course before starting attendance.');
      return;
    }
    setActionLoading(true);
    try {
      const newSession = await startAttendanceSession(selectedClassId);
      setSession(newSession);
      const cls = classes.find((c) => c.id === selectedClassId);
      toast.success('Attendance started', cls ? `${cls.code} — ${cls.name}` : 'Attendance session opened.');
      void notifyStudentsAttendanceStarted(selectedClassId, cls?.name ?? 'your class');

      // Deduct wallet credits nếu institution có wallet
      if (user?.institutionId) {
        try {
          const wallet = await fetchWallet(user.institutionId);
          await deductAttendance({
            walletId: wallet.id,
            attendanceSessionId: newSession.id,
            studentCount: newSession.totalStudents || cls?.studentCount || 0,
          });
        } catch {
          // Không block UI nếu deduct thất bại
          toast.warning('Wallet', 'Could not deduct attendance credits from wallet.');
        }
      }
    } catch {
      toast.error('Failed to open session', 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

  /** Đóng phiên điểm danh */
  const handleEndSession = async () => {
    if (!session) return;
    setActionLoading(true);
    try {
      await endAttendanceSession(session.id);
      setSession(null);
      toast.info('Session ended', 'Attendance data has been saved.');
    } catch {
      toast.error('Failed to close session', 'Please try again in a few seconds.');
    } finally {
      setActionLoading(false);
    }
  };

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
        subtitle="Open attendance sessions for classes and track student presence in real time."
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
          subtitle="Select course and start attendance"
        />

        {classes.length === 0 && !loading ? (
          <div className="flex items-center gap-3 bg-gold/5 border border-gold/20 rounded-xl px-4 py-3 text-sm text-gold">
            <span className="text-lg">⚠️</span>
            <span>No classes are assigned to your account. Please contact your administrator to link your lecturer profile to an institution.</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Course</label>
              <CustomSelect
                value={selectedClassId}
                onChange={setSelectedClassId}
                disabled={!!session || classes.length === 0}
                options={classes.length === 0
                  ? [{value:'', label:'— No classes available —'}]
                  : classes.map((c) => ({value:c.id, label:`${c.code} — ${c.name} · Room ${c.room}`}))
                }
              />
            </div>

            {!session ? (
              <PrimaryButton variant="success" onClick={handleStartSession} disabled={actionLoading || !selectedClassId || classes.length === 0}>
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
              <span className="text-xs text-muted">📍 Room {session.room} · 🕐 {session.startTime}</span>
            </div>
            <SessionStats session={session} />
          </div>
        )}
      </UniCard>

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
          description='Select a course above and click "Start Attendance Session" to begin.'
        />
      )}
    </PageShell>
  );
}
