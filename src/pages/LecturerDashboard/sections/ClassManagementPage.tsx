import React, { useMemo, useState } from 'react';
import { FiBook, FiChevronDown, FiClock, FiMapPin, FiSearch, FiUsers } from 'react-icons/fi';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  AttendanceProgressBar,
  CourseCodeBadge,
  EmptyState,
  FacultyBadge,
  FacultyFilterBar,
  FacultyIcon,
  FilterBar,
  PageHeader,
  PageShell,
  SemesterBadge,
  SkeletonCard,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import { fetchLecturerClasses } from '../../../services/lecturerApi';
import type { ClassStatus, FacultyId, LecturerClass } from '../../../types/lecturer';
import { getAllFaculties } from '../../../utils/facultyTheme';

function StatusBadge({ status }: { status: ClassStatus }) {
  const config = {
    active: { label: 'Đang giảng dạy', dot: 'bg-green', className: 'text-green bg-green/10 border-green/25' },
    completed: { label: 'Đã kết thúc', dot: 'bg-muted', className: 'text-muted bg-white/5 border-border' },
    upcoming: { label: 'Sắp khai giảng', dot: 'bg-gold', className: 'text-gold bg-gold/10 border-gold/25' },
  };
  const { label, dot, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function ClassCard({ cls, index }: { cls: LecturerClass; index: number }) {
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
          <StatusBadge status={cls.status} />
        </div>

        <div className="space-y-3 flex-1">
          {[
            { icon: FiClock, text: cls.schedule },
            { icon: FiMapPin, text: `Phòng ${cls.room}` },
            { icon: FiUsers, text: `${cls.studentCount} sinh viên đăng ký` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
              <Icon className="text-cyan shrink-0 text-base" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {cls.status === 'active' && (
          <div className="mt-5 pt-4 border-t border-border/60">
            <AttendanceProgressBar rate={cls.attendanceRate} facultyId={cls.facultyId} />
          </div>
        )}
      </UniCard>
    </AnimateIn>
  );
}

export default function ClassManagementPage() {
  const { facultyId } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | 'all'>('all');
  const [facultyFilter, setFacultyFilter] = useState<FacultyId | 'all'>('all');

  const { data: classes = [], loading } = useAsyncData(fetchLecturerClasses, []);

  const predicates = useMemo(
    () => [
      (cls: LecturerClass) => statusFilter === 'all' || cls.status === statusFilter,
      (cls: LecturerClass) => facultyFilter === 'all' || cls.facultyId === facultyFilter,
    ],
    [statusFilter, facultyFilter]
  );

  const filteredClasses = useListFilters(classes, search, ['name', 'code'], predicates);

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const activeCount = classes.filter((c) => c.status === 'active').length;
  const faculties = getAllFaculties();

  const facultyCounts = {
    all: classes.length,
    ...Object.fromEntries(faculties.map((f) => [f.id, classes.filter((c) => c.facultyId === f.id).length])),
  } as Record<FacultyId | 'all', number>;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Course Management"
        title="Quản lý lớp học"
        subtitle="Danh sách học phần bạn đang phụ trách trong học kỳ hiện tại."
        facultyId={facultyId}
        stats={[
          { label: 'Học phần', value: String(classes.length), icon: '📚' },
          { label: 'Đang dạy', value: String(activeCount), icon: '✅' },
          { label: 'Sinh viên', value: String(totalStudents), icon: '👥' },
          { label: 'Khoa', value: String(faculties.length), icon: '🏛️' },
        ]}
      />

      <AnimateIn index={1}>
        <FacultyFilterBar
          faculties={faculties}
          active={facultyFilter}
          onChange={setFacultyFilter}
          counts={facultyCounts}
        />
      </AnimateIn>

      <AnimateIn index={2}>
        <FilterBar>
          <div className="uni-filter-input">
            <FiSearch className="text-muted shrink-0" />
            <input
              type="text"
              placeholder="Tìm theo mã học phần, tên lớp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="uni-filter-input sm:max-w-[220px] relative">
            <FiBook className="text-muted shrink-0" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClassStatus | 'all')}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang giảng dạy</option>
              <option value="upcoming">Sắp khai giảng</option>
              <option value="completed">Đã kết thúc</option>
            </select>
            <FiChevronDown className="absolute right-3 text-muted pointer-events-none" />
          </div>
        </FilterBar>
      </AnimateIn>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredClasses.length === 0 ? (
        <EmptyState icon="📚" title="Không tìm thấy lớp học" description="Thử thay đổi bộ lọc khoa hoặc từ khóa tìm kiếm." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredClasses.map((cls, i) => (
            <ClassCard key={cls.id} cls={cls} index={i} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
