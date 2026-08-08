import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCalendar, FiClock } from 'react-icons/fi';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  CourseCodeBadge,
  EmptyState,
  PageHeader,
  PageShell,
  PrimaryButton,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchClassById, fetchExamSlots } from '../../../services/schoolAdminApi';
import type { ExamSlot, ExamSlotStatus, LecturerClass } from '../../../types/lecturer';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ExamStatusBadge({ status }: { status: ExamSlotStatus }) {
  const config: Record<ExamSlotStatus, { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'text-blue-bright bg-blue/10 border-blue/25' },
    ongoing:   { label: 'Ongoing',   className: 'text-green bg-green/10 border-green/25 animate-pulse' },
    completed: { label: 'Completed', className: 'text-muted bg-white/5 border-border' },
    cancelled: { label: 'Cancelled', className: 'text-red bg-red/10 border-red/25' },
  };
  const { label, className } = config[status] ?? { label: status, className: 'text-muted border-border' };
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>;
}

function ExamCard({ exam, cls, index, onOpen }: { exam: ExamSlot; cls: LecturerClass | null; index: number; onOpen: (exam: ExamSlot) => void }) {
  return (
    <AnimateIn index={index}>
      <UniCard facultyId={cls?.facultyId} className="flex flex-col h-full cursor-pointer">
        <button onClick={() => onOpen(exam)} className="text-left bg-transparent border-none p-0 flex flex-col h-full cursor-pointer">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <CourseCodeBadge code={exam.classCode} facultyId={cls?.facultyId} size="sm" />
              <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem]">{exam.examName}</h3>
            </div>
            <ExamStatusBadge status={exam.status} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
              <FiCalendar className="text-cyan shrink-0" />
              <span>Start: {formatDateTime(exam.startTime)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
              <FiClock className="text-cyan shrink-0" />
              <span>End: {formatDateTime(exam.endTime)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60 text-sm font-semibold text-blue-bright">
            View Students →
          </div>
        </button>
      </UniCard>
    </AnimateIn>
  );
}

const PAGE_SIZE = 9;

/** Danh sách bài thi (mình coi thi) của 1 lớp — bấm 1 bài thi để vào roster điểm danh của bài đó. */
export default function AttendanceExamsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [page, setPage] = useState(1);

  const stateCls = (location.state as { cls?: LecturerClass } | null)?.cls ?? null;

  const { data: fetchedCls, loading: loadingCls } = useAsyncData(
    () => (classId && !stateCls ? fetchClassById(classId) : Promise.resolve(null)),
    [classId, stateCls],
  );
  const cls = stateCls ?? fetchedCls;

  const { data, loading: loadingExams, error, reload } = useAsyncData(async () => {
    if (!classId) return [];
    const result = await fetchExamSlots({ page: 1, pageSize: 100 });
    return result.items.filter((e) => e.classId === classId && (!user?.id || e.proctorId === user.id));
  }, [classId, user?.id]);
  const exams = (data ?? []).slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const loading = loadingCls || loadingExams;

  const totalPages = Math.max(1, Math.ceil(exams.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = exams.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [classId]);

  const goToRoster = (exam: ExamSlot) =>
    navigate(`/lecture/attendance/${classId}/${exam.id}`, { state: { exam, cls } });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attendance"
        title={cls ? cls.name : loading ? 'Loading…' : 'Class'}
        subtitle="Select an exam to view the student attendance roster."
        facultyId={cls?.facultyId}
        actions={
          <PrimaryButton variant="ghost" onClick={() => navigate('/lecture/attendance')}>
            <FiArrowLeft /> Back to Classes
          </PrimaryButton>
        }
        stats={cls ? [
          { label: 'Class Code', value: cls.code, icon: '🏷️' },
          { label: 'Exams', value: String(exams.length), icon: '📝' },
        ] : undefined}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📝" title="Failed to load exams" description={error} onRetry={reload} />
      ) : exams.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No exams found"
          description="You're not assigned as proctor for any exam in this class."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pageItems.map((exam, i) => (
              <ExamCard key={exam.id} exam={exam} cls={cls} index={i} onOpen={goToRoster} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${exams.length} exams`} />
        </>
      )}
    </PageShell>
  );
}
