import { useEffect, useState } from 'react';
import {
  FiAlertTriangle, FiCheckCircle, FiClock, FiRadio, FiUser, FiUsers, FiWifi, FiWifiOff,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import {
  EmptyState, PageHeader, PageShell, SkeletonCard, UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import { fetchExamRealtimeState, fetchExamSlots, fetchSchoolAdminClasses } from '../../../services/schoolAdminApi';
import { getViolationLabel } from '../../../utils/violationLabels';
import type {
  BrowserViolationDetectedEventPayload,
  DisqualifiedEventPayload,
  ExamRealtimeStudent,
  ExamSubmittedEventPayload,
  StudentJoinedExamEventPayload,
  StudentOfflineEventPayload,
  StudentOnlineEventPayload,
  ViolationDetectedEventPayload,
} from '../../../types/termination';

// Trang xem giám sát AI real-time trong lúc thi đang diễn ra — khác ViolationReviewPage.tsx (chỉ
// xem lại vi phạm SAU khi đã xảy ra). BE đã có sẵn hạ tầng SignalR đầy đủ (Hubs/ExamHub.cs
// JoinLecturerDashboard + GET /api/exam-slots/{id}/realtime-state) nhưng chưa FE nào dùng tới.

interface FeedItem {
  id: string;
  studentName: string;
  icon: string;
  label: string;
  severity: 'severe' | 'warning' | 'info';
  detail: string;
  at: string;
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const config =
    s === 'submitted' ? { label: 'Submitted', cls: 'text-blue-bright bg-blue/10 border-blue/25' } :
    s === 'disqualified' ? { label: 'Disqualified', cls: 'text-red bg-red/10 border-red/25' } :
    s === 'left' ? { label: 'Left', cls: 'text-muted bg-white/5 border-border' } :
    { label: 'In Progress', cls: 'text-green bg-green/10 border-green/25' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.cls}`}>{config.label}</span>;
}

function FeedRow({ item }: { item: FeedItem }) {
  const tone =
    item.severity === 'severe' ? 'border-red/30 bg-red/5' :
    item.severity === 'warning' ? 'border-gold/30 bg-gold/5' :
    'border-border bg-navy/40';
  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${tone}`}>
      <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white-soft font-medium truncate">
          {item.studentName} <span className="text-muted font-normal">— {item.label}</span>
        </p>
        {item.detail && <p className="text-[11px] text-muted mt-0.5">{item.detail}</p>}
      </div>
      <span className="text-[10px] text-muted font-mono shrink-0">{fmtTime(item.at)}</span>
    </div>
  );
}

export default function LiveMonitoringPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState<Record<string, ExamRealtimeStudent>>({});
  const [examLabel, setExamLabel] = useState('');
  const [loadingState, setLoadingState] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const { data: examsData, loading: loadingExams } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 100 });
    return result.items;
  }, []);
  // GET /api/exam-slots trả về TẤT CẢ bài thi trong hệ thống, không lọc theo lecturer. BE
  // (ExamWorkflowService.EnsureStaffAccessAsync, dùng bởi GetRealtimeStateAsync) chỉ cho phép đúng
  // Class.LecturerId == user.Id — KHÔNG phải ExamSlot.ProctorId (2 field khác nhau, xem
  // AttendanceRosterPage.tsx cho trường hợp dùng ProctorId). Trước đây lấy nguyên "mọi exam đang
  // ongoing" nên tự động chọn nhầm bài thi của lớp khác, khiến GET /realtime-state luôn bị BE từ
  // chối 403 "Access denied." — phải lọc theo đúng lớp lecturer này làm chủ nhiệm.
  const { data: myClasses } = useAsyncData(async () => {
    const result = await fetchSchoolAdminClasses({ page: 1, pageSize: 100 });
    return result.items;
  }, []);
  const myClassIds = new Set((myClasses ?? []).filter((c) => c.lecturerId === user?.id).map((c) => c.id));
  const ongoingExams = (examsData ?? []).filter((e) => e.status === 'ongoing' && myClassIds.has(e.classId));

  useEffect(() => {
    if (!selectedExamId && ongoingExams.length > 0) setSelectedExamId(ongoingExams[0].id);
  }, [ongoingExams, selectedExamId]);

  // Snapshot ban đầu — SignalR chỉ báo thay đổi TỪ THỜI ĐIỂM join trở đi, không có state cũ.
  useEffect(() => {
    if (!selectedExamId) { setStudents({}); setFeed([]); return; }
    setLoadingState(true);
    setFeed([]);
    fetchExamRealtimeState(selectedExamId)
      .then((state) => {
        setExamLabel(state.examName ?? '');
        setStudents(Object.fromEntries(state.students.map((s) => [s.participationId, s])));
      })
      .catch(() => { setStudents({}); })
      .finally(() => setLoadingState(false));
  }, [selectedExamId]);

  const examHub = useHubConnection(HubRoute.Exams, !!selectedExamId);
  useHubGroup(HubRoute.Exams, 'JoinLecturerDashboard', selectedExamId ? [selectedExamId] : null);

  const updateStudent = (
    participationId: string,
    patch: Partial<ExamRealtimeStudent> | ((s: ExamRealtimeStudent) => Partial<ExamRealtimeStudent>),
  ) => {
    setStudents((prev) => {
      const existing = prev[participationId];
      if (!existing) return prev;
      const resolved = typeof patch === 'function' ? patch(existing) : patch;
      return { ...prev, [participationId]: { ...existing, ...resolved } };
    });
  };

  const pushFeed = (item: FeedItem) => setFeed((prev) => [item, ...prev].slice(0, 100));

  useHubEvent<StudentOnlineEventPayload>(examHub, 'StudentOnline', (p) => {
    updateStudent(p.participationId, { isOnline: true });
  });

  useHubEvent<StudentOfflineEventPayload>(examHub, 'StudentOffline', (p) => {
    updateStudent(p.participationId, { isOnline: false });
  });

  useHubEvent<StudentJoinedExamEventPayload>(examHub, 'StudentJoinedExam', (p) => {
    if (p.examSlotId !== selectedExamId) return;
    setStudents((prev) => (prev[p.participationId] ? prev : {
      ...prev,
      [p.participationId]: {
        participationId: p.participationId, studentId: p.studentId, fullName: p.fullName,
        status: 'Joined', actualStart: p.joinedAt, actualEnd: null, lastSeenAt: p.joinedAt,
        isOnline: true, violationCount: 0,
      },
    }));
  });

  useHubEvent<ExamSubmittedEventPayload>(examHub, 'ExamSubmitted', (p) => {
    if (p.examSlotId !== selectedExamId) return;
    updateStudent(p.participationId, { status: 'Submitted', isOnline: false });
  });

  useHubEvent<DisqualifiedEventPayload>(examHub, 'Disqualified', (p) => {
    if (p.examSlotId !== selectedExamId) return;
    updateStudent(p.participationId, { status: 'Disqualified', isOnline: false });
    pushFeed({
      id: `dq-${p.participationId}-${Date.now()}`,
      studentName: p.fullName ?? students[p.participationId]?.fullName ?? 'Student',
      icon: '⛔', label: 'Disqualified', severity: 'severe',
      detail: p.reason ?? '', at: p.disqualifiedAt ?? new Date().toISOString(),
    });
    toast.error('Student disqualified', `${p.fullName ?? 'A student'} was disqualified from the exam.`);
  });

  useHubEvent<BrowserViolationDetectedEventPayload>(examHub, 'BrowserViolationDetected', (p) => {
    const student = students[p.participationId];
    if (!student) return; // không thuộc exam đang xem (event này không có examSlotId để lọc trực tiếp)
    updateStudent(p.participationId, (s) => ({ violationCount: s.violationCount + 1 }));
    const { icon, label } = getViolationLabel(p.violationType);
    pushFeed({
      id: `bv-${p.participationId}-${Date.now()}`,
      studentName: student.fullName, icon, label,
      severity: p.examTerminated ? 'severe' : 'warning',
      detail: `Browser violation #${p.currentViolationCount}`,
      at: p.recordedAt ?? new Date().toISOString(),
    });
  });

  useHubEvent<ViolationDetectedEventPayload>(examHub, 'ViolationDetected', (p) => {
    if (p.examSlotId !== selectedExamId) return;
    updateStudent(p.participationId, (s) => ({ violationCount: s.violationCount + 1 }));
    const { icon, label } = getViolationLabel(p.type);
    const isSevere = p.severity?.toLowerCase() === 'severe';
    pushFeed({
      id: p.violationId, studentName: p.fullName, icon, label,
      severity: isSevere ? 'severe' : 'warning',
      detail: p.confidence != null ? `AI confidence ${Math.round(p.confidence * 100)}%` : '',
      at: p.recordedAt,
    });
    if (isSevere) toast.warning('Violation detected', `${p.fullName} — ${label}`);
  });

  const studentList = Object.values(students).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const onlineCount = studentList.filter((s) => s.isOnline).length;
  const submittedCount = studentList.filter((s) => s.status.toLowerCase() === 'submitted').length;
  const disqualifiedCount = studentList.filter((s) => s.status.toLowerCase() === 'disqualified').length;
  const violationTotal = studentList.reduce((sum, s) => sum + s.violationCount, 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Live Proctoring"
        title="Live Exam Monitoring"
        subtitle="Real-time AI violation alerts and student presence while an exam is in progress."
        stats={[
          { label: 'Students', value: String(studentList.length), icon: '👥' },
          { label: 'Online', value: String(onlineCount), icon: '🟢' },
          { label: 'Submitted', value: String(submittedCount), icon: '✅' },
          { label: 'Violations', value: String(violationTotal), icon: '⚠️' },
        ]}
      />

      <UniCard hover={false} className="!p-5">
        <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Ongoing Exam</label>
        {loadingExams ? (
          <div className="h-10 bg-white/5 rounded-xl animate-pulse max-w-md" />
        ) : ongoingExams.length === 0 ? (
          <p className="text-sm text-muted">No exam is currently ongoing. This page only monitors exams while they're in progress.</p>
        ) : (
          <CustomSelect
            value={selectedExamId}
            onChange={setSelectedExamId}
            options={ongoingExams.map((e) => ({ value: e.id, label: `${e.classCode} — ${e.examName}` }))}
            className="max-w-md"
          />
        )}
      </UniCard>

      {selectedExamId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Student grid */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-syne font-bold text-white-soft text-sm flex items-center gap-2">
              <FiUsers /> {examLabel || 'Students'}
            </h2>
            {loadingState ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : studentList.length === 0 ? (
              <EmptyState icon="👥" title="No participants yet" description="Students will appear here as they join the exam." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentList.map((s) => (
                  <div key={s.participationId} className="bg-navy-card border border-border rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue/10 border border-blue/20 grid place-items-center shrink-0">
                          <FiUser className="text-blue-bright text-xs" />
                        </div>
                        <p className="text-sm font-semibold text-white-soft truncate">{s.fullName}</p>
                      </div>
                      {s.isOnline ? (
                        <FiWifi className="text-green shrink-0" title="Online" />
                      ) : (
                        <FiWifiOff className="text-muted shrink-0" title="Offline" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={s.status} />
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${s.violationCount > 0 ? 'text-red' : 'text-muted'}`}>
                        <FiAlertTriangle size={10} /> {s.violationCount}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
                      <FiClock size={10} /> Last seen {fmtTime(s.lastSeenAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live violation feed */}
          <div className="space-y-3">
            <h2 className="font-syne font-bold text-white-soft text-sm flex items-center gap-2">
              <FiRadio className="text-red animate-pulse" /> Live Feed
            </h2>
            <div className="bg-navy-card border border-border rounded-2xl p-3 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              {feed.length === 0 ? (
                <div className="py-10 text-center">
                  <FiCheckCircle className="text-3xl text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-muted text-xs">No events yet — this updates live as they happen.</p>
                </div>
              ) : (
                feed.map((item) => <FeedRow key={item.id} item={item} />)
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
