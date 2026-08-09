import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCalendar, FiClock, FiFileText, FiSearch } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import { useAuth } from '../../../contexts/AuthContext';
import {
  CourseCodeBadge,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
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

function ExamSlotCard({ slot, index }: { slot: ExamSlot; index: number }) {
  const navigate = useNavigate();

  const handleViewQuestions = () => {
    localStorage.setItem(`examName_${slot.id}`, slot.examName);
    navigate(`/lecture/exams/${slot.id}/questions`);
  };

  return (
    <AnimateIn index={index}>
      <UniCard className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <CourseCodeBadge code={slot.classCode} size="sm" />
            <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem]">{slot.examName}</h3>
            <p className="text-sm text-muted mt-1">{slot.className}</p>
          </div>
          <ExamStatusBadge status={slot.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiCalendar className="text-cyan shrink-0" />
            <span>Start: {formatDateTime(slot.startTime)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiCalendar className="text-cyan shrink-0" />
            <span>End: {formatDateTime(slot.endTime)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
            <FiClock className="text-cyan shrink-0" />
            <span>Duration: {slot.durationMinutes > 0 ? `${slot.durationMinutes} min` : 'Not set'}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
          <button
            onClick={handleViewQuestions}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-cyan/30 text-cyan text-sm font-semibold cursor-pointer hover:bg-cyan/10 transition-colors bg-transparent"
          >
            <FiFileText className="text-sm" /> Questions
          </button>
        </div>
      </UniCard>
    </AnimateIn>
  );
}

const PAGE_SIZE = 9;

/** Danh sách bài thi (mình coi thi) của 1 lớp cụ thể — vào từ ExamClassesPage (chọn lớp trước),
 *  khớp luồng Class → Exams đã dùng ở Attendance. */
export default function ExamSlotsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamSlotStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const stateCls = (location.state as { cls?: LecturerClass } | null)?.cls ?? null;
  const { data: fetchedCls, loading: loadingCls } = useAsyncData(
    () => (classId && !stateCls ? fetchClassById(classId) : Promise.resolve(null)),
    [classId, stateCls],
  );
  const cls = stateCls ?? fetchedCls;

  const { data, loading: loadingSlots, error, reload } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 100 });
    return result.items;
  }, []);

  // BE /api/exam-slots chưa scope theo proctor — trả về TOÀN BỘ exam slot của cả hệ thống cho
  // bất kỳ ai gọi. Lọc client-side theo đúng lớp đang xem + chỉ đề mình được phân công coi thi.
  const slots = (data ?? []).filter((s) => (!classId || s.classId === classId) && (!user?.id || s.proctorId === user.id));

  const predicates = useMemo(
    () => [(slot: ExamSlot) => statusFilter === 'all' || slot.status === statusFilter],
    [statusFilter],
  );

  const filteredSlots = useListFilters(slots, search, ['examName', 'classCode', 'className'], predicates);

  const totalPages = Math.max(1, Math.ceil(filteredSlots.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredSlots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter, classId]);

  const loading = loadingCls || loadingSlots;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Schedule"
        title={cls ? cls.name : loading ? 'Loading…' : 'Exams'}
        subtitle="View exams you're proctoring for this class."
        facultyId={cls?.facultyId}
        actions={
          <PrimaryButton variant="ghost" onClick={() => navigate('/lecture/exams')}>
            <FiArrowLeft /> Back to Classes
          </PrimaryButton>
        }
        stats={[
          { label: 'Total',     value: String(slots.length), icon: '📝' },
          { label: 'Scheduled', value: String(slots.filter(s => s.status === 'scheduled').length), icon: '📅' },
          { label: 'Ongoing',   value: String(slots.filter(s => s.status === 'ongoing').length), icon: '🔴' },
          { label: 'Completed', value: String(slots.filter(s => s.status === 'completed').length), icon: '✅' },
        ]}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search exam name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as ExamSlotStatus | 'all')}
          options={[
            { value: 'all',       label: 'All Statuses' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'ongoing',   label: 'Ongoing' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </FilterBar>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📝" title="Failed to load exam slots" description={error} onRetry={reload} />
      ) : filteredSlots.length === 0 ? (
        <EmptyState icon="📝" title="No exam slots" description="No exam slots assigned to you for this class yet." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pageItems.map((slot, i) => (
              <ExamSlotCard key={slot.id} slot={slot} index={i} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${filteredSlots.length} exams`} />
        </>
      )}
    </PageShell>
  );
}
