import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFolder, FiStopCircle, FiUsers } from 'react-icons/fi';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  ClassStatusBadge,
  CourseCodeBadge,
  EmptyState,
  FacultyIcon,
  PageHeader,
  PageShell,
  SectionTitle,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { fetchExamSlots, fetchSchoolAdminClasses } from '../../../services/schoolAdminApi';
import {
  endAttendanceSession,
  fetchMyOpenAttendanceSessions,
  type OpenSessionSummary,
} from '../../../services/lecturerApi';
import type { LecturerClass } from '../../../types/lecturer';

function computeEndTime(examEndTime: string | null | undefined): string {
  if (examEndTime && new Date(examEndTime).getTime() < Date.now()) return examEndTime;
  return new Date().toISOString();
}

function ClassCard({ cls, index, onOpen }: { cls: LecturerClass; index: number; onOpen: (cls: LecturerClass) => void }) {
  return (
    <AnimateIn index={index}>
      <UniCard facultyId={cls.facultyId} className="flex flex-col h-full cursor-pointer" >
        <button onClick={() => onOpen(cls)} className="text-left bg-transparent border-none p-0 flex flex-col h-full cursor-pointer">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3">
              <FacultyIcon facultyId={cls.facultyId} />
              <div>
                <CourseCodeBadge code={cls.code} facultyId={cls.facultyId} />
                <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem] leading-snug">
                  {cls.name}
                </h3>
              </div>
            </div>
            <ClassStatusBadge status={cls.status} />
          </div>

          <div className="space-y-3 flex-1">
            {[
              { icon: FiUsers, text: `${cls.studentCount} students registered` },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                <Icon className="text-cyan shrink-0 text-base" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border/60 text-sm font-semibold text-blue-bright">
            View Exams →
          </div>
        </button>
      </UniCard>
    </AnimateIn>
  );
}

/** Trang gốc "Attendance": chọn lớp trước khi vào danh sách bài thi → danh sách sinh viên. Chỉ hiện
 *  lớp mà mình được phân công coi thi (proctor) ít nhất 1 bài, khớp cách ExamSlotsPage đang lọc. */
const PAGE_SIZE = 9;

export default function AttendanceClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [openSessions, setOpenSessions] = useState<OpenSessionSummary[]>([]);
  const [loadingOpenSessions, setLoadingOpenSessions] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [classRes, examRes] = await Promise.all([
      fetchSchoolAdminClasses({ page: 1, pageSize: 50 }),
      fetchExamSlots({ page: 1, pageSize: 100 }),
    ]);
    const myClassIds = new Set(
      examRes.items.filter((e) => e.proctorId === user?.id).map((e) => e.classId),
    );
    return classRes.items.filter((c) => myClassIds.has(c.id));
  }, [user?.id]);
  const classes = data ?? [];
  const totalPages = Math.max(1, Math.ceil(classes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = classes.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Toàn bộ session mình từng mở mà quên End — hệ thống không tự đóng theo giờ ca thi, panel này
  // cho dọn tay bất kể session đó thuộc bài thi/lớp nào (chuyển từ trang session cũ lên đây, vì giờ
  // luồng điểm danh không còn 1 trang duy nhất để đặt panel này nữa).
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

  useEffect(() => {
    void loadOpenSessions();
    if (!user?.id) return;
    const interval = setInterval(() => { void loadOpenSessions(); }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleEndOpenSession = async (id: string) => {
    setEndingId(id);
    try {
      const target = openSessions.find((s) => s.id === id);
      await endAttendanceSession(id, computeEndTime(target?.examEndTime));
      toast.success('Session ended', 'Closed successfully.');
      await loadOpenSessions();
    } catch {
      toast.error('Failed to close session', 'Please try again in a few seconds.');
    } finally {
      setEndingId(null);
    }
  };

  const goToExams = (cls: LecturerClass) =>
    navigate(`/lecture/attendance/${cls.id}`, { state: { cls } });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attendance"
        title="Attendance"
        subtitle="Pick a class, then an exam, to view student attendance status and take attendance."
        stats={[
          { label: 'Classes', value: String(classes.length), icon: '📚' },
          { label: 'Open Sessions', value: String(openSessions.length), icon: '📋' },
        ]}
      />

      {!loadingOpenSessions && openSessions.length > 0 && (
        <UniCard accent="gold" hover={false} className="!p-6">
          <SectionTitle
            icon={<FiFolder className="text-gold" />}
            title={`Open Sessions (${openSessions.length})`}
            subtitle="Sessions linked to an exam auto-close once the exam ends while this page is open. Sessions without a linked exam (or closed while you were away) need ending manually."
          />
          <div className="space-y-2 mt-4">
            {openSessions.map((s) => {
              const isEnding = endingId === s.id;
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📋" title="Failed to load classes" description={error} onRetry={reload} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No classes to take attendance for"
          description="You'll see a class here once you're assigned as proctor for one of its exams."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pageItems.map((cls, i) => (
              <ClassCard key={cls.id} cls={cls} index={i} onOpen={goToExams} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${classes.length} classes`} />
        </>
      )}
    </PageShell>
  );
}
