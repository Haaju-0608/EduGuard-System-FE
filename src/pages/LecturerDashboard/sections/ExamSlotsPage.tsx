import React, { useMemo, useState } from 'react';
import { FiCalendar, FiClock, FiSearch } from 'react-icons/fi';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  CourseCodeBadge,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import { fetchExamSlots } from '../../../services/schoolAdminApi';
import type { ExamSlot, ExamSlotStatus } from '../../../types/lecturer';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExamStatusBadge({ status }: { status: ExamSlotStatus }) {
  const config: Record<ExamSlotStatus, { label: string; className: string }> = {
    scheduled: { label: 'Scheduled', className: 'text-blue-bright bg-blue/10 border-blue/25' },
    ongoing: { label: 'Ongoing', className: 'text-green bg-green/10 border-green/25' },
    completed: { label: 'Completed', className: 'text-muted bg-white/5 border-border' },
    cancelled: { label: 'Cancelled', className: 'text-red bg-red/10 border-red/25' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  );
}

function ExamSlotCard({ slot, index }: { slot: ExamSlot; index: number }) {
  return (
    <AnimateIn index={index}>
      <UniCard className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <CourseCodeBadge code={slot.classCode} size="sm" />
            <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem]">{slot.examName}</h3>
            <p className="text-sm text-muted mt-1">{slot.className}</p>
          </div>
          <ExamStatusBadge status={slot.status} />
        </div>

        <div className="space-y-3 flex-1">
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
            <span>
              Duration: {slot.durationMinutes > 0 ? `${slot.durationMinutes} minutes` : 'Not set'}
            </span>
          </div>
        </div>
      </UniCard>
    </AnimateIn>
  );
}

/** Trang quản lý ca thi — GET /api/exam-slots */
export default function ExamSlotsPage() {
  const { facultyId } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamSlotStatus | 'all'>('all');

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 50 });
    return result.items;
  }, []);

  const slots = data ?? [];

  const predicates = useMemo(
    () => [(slot: ExamSlot) => statusFilter === 'all' || slot.status === statusFilter],
    [statusFilter],
  );

  const filteredSlots = useListFilters(slots, search, ['examName', 'classCode', 'className'], predicates);

  const scheduledCount = slots.filter((s) => s.status === 'scheduled').length;
  const ongoingCount = slots.filter((s) => s.status === 'ongoing').length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Schedule"
        title="Exam Slots"
        subtitle="List of exam sessions by class — proctoring and monitoring schedule."
        facultyId={facultyId}
        stats={[
          { label: 'Total Slots', value: String(slots.length), icon: '📝' },
          { label: 'Scheduled', value: String(scheduledCount), icon: '📅' },
          { label: 'Ongoing', value: String(ongoingCount), icon: '🔴' },
          { label: 'Completed', value: String(slots.filter((s) => s.status === 'completed').length), icon: '✅' },
        ]}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search exam name, course code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="uni-filter-input sm:max-w-[200px] relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExamSlotStatus | 'all')}
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </FilterBar>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState variant="error" icon="📝" title="Failed to load exam slots" description={error} onRetry={reload} />
      ) : filteredSlots.length === 0 ? (
        <EmptyState icon="📝" title="No exam slots" description="Try changing the filter or search keyword." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSlots.map((slot, i) => (
            <ExamSlotCard key={slot.id} slot={slot} index={i} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
