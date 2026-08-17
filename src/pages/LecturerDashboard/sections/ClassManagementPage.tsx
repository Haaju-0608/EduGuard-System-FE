import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiSearch, FiUsers } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  AttendanceProgressBar,
  ClassStatusBadge,
  CourseCodeBadge,
  EmptyState,
  FacultyBadge,
  FacultyIcon,
  FilterBar,
  PageHeader,
  PageShell,
  SemesterBadge,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import { HubRoute } from '../../../services/realtimeClient';
import { fetchClassAttendanceRate } from '../../../services/lecturerApi';
import { fetchSchoolAdminClasses } from '../../../services/schoolAdminApi';
import type { ClassStatus, LecturerClass } from '../../../types/lecturer';

// ─── Class Card ───────────────────────────────────────────────────────────────

function ClassCard({ cls, index, onViewStudents }: { cls: LecturerClass; index: number; onViewStudents: (cls: LecturerClass) => void }) {
  return (
    <AnimateIn index={index}>
      <UniCard facultyId={cls.facultyId} className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <FacultyIcon facultyId={cls.facultyId} />
            <div>
              <CourseCodeBadge code={cls.code} facultyId={cls.facultyId} />
              <h3 className="font-syne font-bold text-white-soft mt-2 text-[1.05rem] leading-snug">
                {cls.name}
              </h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <SemesterBadge semester={cls.semester} />
                <FacultyBadge facultyId={cls.facultyId} size="sm" />
              </div>
            </div>
          </div>
          <ClassStatusBadge status={cls.status} />
        </div>

        <div className="space-y-3 flex-1">
          {[
            { icon: FiClock, text: cls.schedule },
            { icon: FiUsers, text: `${cls.studentCount} students registered` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
              <Icon className="text-cyan shrink-0 text-base" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {cls.status === 'active' && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <AttendanceProgressBar rate={cls.attendanceRate} facultyId={cls.facultyId} />
          </div>
        )}

        {/* View Students button */}
        <button
          onClick={() => onViewStudents(cls)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold hover:border-blue/40 hover:text-blue-bright hover:bg-blue/5 transition-all cursor-pointer"
        >
          <FiUsers size={14} />
          View Students
        </button>
      </UniCard>
    </AnimateIn>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 9;

export default function ClassManagementPage() {
  const navigate = useNavigate();
  const { facultyId, user } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const goToRoster = (cls: LecturerClass) =>
    navigate(`/lecture/classes/${cls.id}`, { state: { cls } });

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchSchoolAdminClasses({ page: 1, pageSize: 50 });
    // attendanceRate luôn về 0 từ fetchSchoolAdminClasses (response /api/classes không có dữ liệu
    // điểm danh) — tính bù ở đây bằng cách gộp record từ mọi session từng mở cho từng lớp.
    const rates = await Promise.all(
      result.items.map((cls) => fetchClassAttendanceRate(cls.id).catch(() => 0)),
    );
    return result.items.map((cls, i) => ({ ...cls, attendanceRate: rates[i] }));
  }, []);
  const classes = data ?? [];

  // Realtime: BE bắn ResourceChanged(resource="classes"/"class-enrollments"/"attendance-records")
  // tới group dashboard:lecturer:{id} mỗi khi lớp/sĩ số/điểm danh của lecturer này đổi.
  const dashboardHub = useHubConnection(HubRoute.Dashboard, !!user?.id);
  useHubGroup(HubRoute.Dashboard, 'JoinLecturerDashboard', user?.id ? [user.id] : null);
  useHubEvent<{ resource: string }>(dashboardHub, 'ResourceChanged', (payload) => {
    if (!['classes', 'class-enrollments', 'attendance-records', 'attendance-sessions'].includes(payload.resource)) return;
    reload();
  });

  const predicates = useMemo(
    () => [(cls: LecturerClass) => statusFilter === 'all' || cls.status === statusFilter],
    [statusFilter],
  );

  const filteredClasses = useListFilters(classes, search, ['name', 'code'], predicates);

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredClasses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const activeCount = classes.filter((c) => c.status === 'active').length;
  const completedCount = classes.filter((c) => c.status === 'completed').length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Class Management"
        title="My Exam Classes"
        subtitle="Classes assigned to you for exam proctoring."
        facultyId={facultyId}
        stats={[
          { label: 'Exam Classes', value: String(classes.length),   icon: '📝' },
          { label: 'Active',       value: String(activeCount),      icon: '✅' },
          { label: 'Completed',    value: String(completedCount),   icon: '🏁' },
          { label: 'Students',     value: String(totalStudents),    icon: '👥' },
        ]}
      />

      <AnimateIn index={1}>
        <FilterBar>
          <div className="uni-filter-input">
            <FiSearch className="text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search class code, class name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CustomSelect
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as ClassStatus | 'all')}
            options={[
              { value: 'all',       label: 'All Statuses' },
              { value: 'active',    label: 'Active' },
              { value: 'upcoming',  label: 'Upcoming' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </FilterBar>
      </AnimateIn>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          icon="📚"
          title="Failed to load classes"
          description={error}
          onRetry={reload}
        />
      ) : filteredClasses.length === 0 ? (
        <EmptyState icon="📚" title="No classes found" description="Try changing the faculty filter or search keyword." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pageItems.map((cls, i) => (
              <ClassCard key={cls.id} cls={cls} index={i} onViewStudents={goToRoster} />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${filteredClasses.length} classes`} />
        </>
      )}
    </PageShell>
  );
}
