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
  endAttendanceSession,
  fetchActiveAttendanceSession,
  fetchLecturerClasses,
  startAttendanceSession,
} from '../../../services/lecturerApi';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus, LecturerClass } from '../../../types/lecturer';

/** Badge trạng thái điểm danh */
function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const config = {
    present: { label: 'Có mặt', icon: FiCheckCircle, className: 'text-green bg-green/10 border-green/25' },
    absent: { label: 'Vắng', icon: FiXCircle, className: 'text-red bg-red/10 border-red/25' },
    late: { label: 'Muộn', icon: FiClock, className: 'text-gold bg-gold/10 border-gold/25' },
    excused: { label: 'Có phép', icon: FiCheckCircle, className: 'text-blue-bright bg-blue/10 border-blue/25' },
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
    { label: 'Tổng sinh viên', value: session.records.length, color: 'text-blue-bright', bg: 'bg-blue/10', icon: FiUsers },
    { label: 'Có mặt', value: presentCount, color: 'text-green', bg: 'bg-green/10', icon: FiCheckCircle },
    { label: 'Vắng mặt', value: absentCount, color: 'text-red', bg: 'bg-red/10', icon: FiXCircle },
    { label: 'Tỷ lệ tham dự', value: `${rate}%`, color: 'text-cyan', bg: 'bg-cyan/10', icon: FiClock },
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
      const [classData, sessionData] = await Promise.all([fetchLecturerClasses(), fetchActiveAttendanceSession()]);
      setClasses(classData.filter((c) => c.status === 'active'));
      setSession(sessionData);
      if (sessionData) setSelectedClassId(sessionData.classId);
      else if (classData.length > 0) setSelectedClassId(classData[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  /** Mở phiên điểm danh mới */
  const handleStartSession = async () => {
    if (!selectedClassId) {
      toast.warning('Chưa chọn lớp', 'Vui lòng chọn học phần trước khi bắt đầu điểm danh.');
      return;
    }
    setActionLoading(true);
    try {
      const newSession = await startAttendanceSession(selectedClassId);
      setSession(newSession);
      const cls = classes.find((c) => c.id === selectedClassId);
      toast.success('Bắt đầu điểm danh', cls ? `${cls.code} — ${cls.name}` : 'Phiên điểm danh đã mở.');
    } catch {
      toast.error('Không mở được phiên', 'Vui lòng thử lại sau vài giây.');
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
      toast.info('Đã kết thúc phiên', 'Dữ liệu điểm danh đã được lưu.');
    } catch {
      toast.error('Không đóng được phiên', 'Vui lòng thử lại sau vài giây.');
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
        title="Phiên điểm danh"
        subtitle="Mở phiên điểm danh cho lớp học và theo dõi sinh viên có mặt / vắng theo thời gian thực."
        actions={
          <PrimaryButton variant="ghost" onClick={loadData} disabled={loading}>
            <FiRefreshCw className={`text-sm ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </PrimaryButton>
        }
      />

      <UniCard accent="green" hover={false} className="!p-6">
        <SectionTitle
          icon={<FiUsers className="text-green" />}
          title="Điều khiển phiên"
          subtitle="Chọn học phần và bắt đầu điểm danh"
        />

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Học phần</label>
            <div className="uni-filter-input">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={!!session}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name} · Phòng {c.room}</option>
                ))}
              </select>
            </div>
          </div>

          {!session ? (
            <PrimaryButton variant="success" onClick={handleStartSession} disabled={actionLoading || !selectedClassId}>
              <FiPlay /> {actionLoading ? 'Đang mở...' : 'Mở phiên điểm danh'}
            </PrimaryButton>
          ) : (
            <PrimaryButton variant="danger" onClick={handleEndSession} disabled={actionLoading}>
              <FiStopCircle /> {actionLoading ? 'Đang đóng...' : 'Kết thúc phiên'}
            </PrimaryButton>
          )}
        </div>

        {session && (
          <div className="mt-6 pt-6 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="flex items-center gap-1.5 text-xs text-green font-bold bg-green/10 border border-green/25 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green rounded-full animate-pulse" /> Phiên đang diễn ra
              </span>
              <span className="course-code-badge text-xs">{session.classCode}</span>
              <span className="text-sm text-white-soft font-semibold">{session.className}</span>
              <span className="text-xs text-muted">📍 Phòng {session.room} · 🕐 {session.startTime}</span>
            </div>
            <SessionStats session={session} />
          </div>
        )}
      </UniCard>

      {session && (
        <>
          <FilterPills
            tabs={[
              { key: 'all', label: 'Tất cả' },
              { key: 'present', label: 'Có mặt' },
              { key: 'absent', label: 'Vắng' },
              { key: 'late', label: 'Muộn' },
              { key: 'excused', label: 'Có phép' },
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
                Danh sách có mặt
                <span className="text-sm font-normal text-muted">({presentRecords.length})</span>
              </h2>
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                {presentRecords.length === 0 ? (
                  <p className="text-muted text-sm text-center py-8">Chưa có sinh viên</p>
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
                Danh sách vắng mặt
                <span className="text-sm font-normal text-muted">({absentRecords.length})</span>
              </h2>
              <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                {absentRecords.length === 0 ? (
                  <p className="text-muted text-sm text-center py-8">Tất cả sinh viên đều có mặt 🎉</p>
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
          title="Chưa có phiên điểm danh"
          description='Chọn học phần ở trên và nhấn "Mở phiên điểm danh" để bắt đầu buổi học.'
        />
      )}
    </PageShell>
  );
}
