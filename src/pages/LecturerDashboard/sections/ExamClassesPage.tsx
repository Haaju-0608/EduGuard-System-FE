import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers } from 'react-icons/fi';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  ClassStatusBadge,
  CourseCodeBadge,
  EmptyState,
  FacultyIcon,
  PageHeader,
  PageShell,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchExamSlots, fetchSchoolAdminClasses } from '../../../services/schoolAdminApi';
import type { LecturerClass } from '../../../types/lecturer';

function ClassCard({ cls, index, onOpen }: { cls: LecturerClass; index: number; onOpen: (cls: LecturerClass) => void }) {
  return (
    <AnimateIn index={index}>
      <UniCard facultyId={cls.facultyId} className="flex flex-col h-full cursor-pointer">
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
            <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
              <FiUsers className="text-cyan shrink-0 text-base" />
              <span>{cls.studentCount} students registered</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/60 text-sm font-semibold text-blue-bright">
            View Exams →
          </div>
        </button>
      </UniCard>
    </AnimateIn>
  );
}

const PAGE_SIZE = 9;

/** Trang gốc "Exams": chọn lớp trước khi vào danh sách bài thi — khớp luồng Class → Exams đã dùng ở
 *  Attendance. Chỉ hiện lớp mà mình được phân công coi thi (proctor) ít nhất 1 bài. */
export default function ExamClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const goToExams = (cls: LecturerClass) =>
    navigate(`/lecture/exams/${cls.id}`, { state: { cls } });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Schedule"
        title="Exams"
        subtitle="Pick a class to view the exams you're proctoring for it."
        stats={[
          { label: 'Classes', value: String(classes.length), icon: '📚' },
        ]}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📝" title="Failed to load classes" description={error} onRetry={reload} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No classes with exams assigned"
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
