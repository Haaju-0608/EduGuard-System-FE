import React, { useMemo, useState } from 'react';
import { FiClock, FiMapPin, FiSearch, FiUsers, FiX, FiUser } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { AnimateIn } from '../../../components/lecturer/LecturerAnimations';
import {
  AttendanceProgressBar,
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
import StudentExamHistoryModal from '../../../components/lecturer/StudentExamHistoryModal';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';
import { fetchSchoolAdminClasses, fetchClassEnrollmentsWithStudents } from '../../../services/schoolAdminApi';
import type { ClassStatus, LecturerClass } from '../../../types/lecturer';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClassStatus }) {
  const config = {
    active:    { label: 'Active',    dot: 'bg-green', className: 'text-green bg-green/10 border-green/25' },
    completed: { label: 'Completed', dot: 'bg-muted',  className: 'text-muted bg-white/5 border-border' },
    upcoming:  { label: 'Upcoming',  dot: 'bg-gold',   className: 'text-gold bg-gold/10 border-gold/25' },
  };
  const { label, dot, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ─── Student List Modal ───────────────────────────────────────────────────────

function StudentListModal({ cls, onClose }: { cls: LecturerClass; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, loading, error } = useAsyncData(
    () => fetchClassEnrollmentsWithStudents(cls.id),
    [cls.id],
  );

  const enrollments = data ?? [];
  const filtered = enrollments.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = e.student?.fullName?.toLowerCase() ?? '';
    const email = e.student?.email?.toLowerCase() ?? '';
    const code = e.student?.studentCode?.toLowerCase() ?? '';
    return name.includes(q) || email.includes(q) || code.includes(q);
  });

  function getInitials(name: string) {
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-navy-card border border-border rounded-[20px] w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold text-blue-bright bg-blue/10 border border-blue/20 px-2 py-0.5 rounded-full font-mono">
                {cls.code}
              </span>
              <StatusBadge status={cls.status} />
            </div>
            <h2 className="font-syne font-bold text-white-soft mt-1">{cls.name}</h2>
            <p className="text-xs text-muted mt-0.5">
              {loading ? 'Loading…' : `${enrollments.length} students enrolled`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-white-soft hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 bg-navy border border-border rounded-xl px-3 py-2 focus-within:border-blue-bright/40 transition-colors">
            <FiSearch size={14} className="text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email or student code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white-soft placeholder:text-muted outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-navy/40 border border-border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-muted text-sm">
                {enrollments.length === 0 ? 'No students enrolled yet.' : 'No results found.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((e, idx) => {
                const name = e.student?.fullName?.trim() || e.student?.email || 'Unknown';
                const initials = getInitials(name);
                const code = e.student?.studentCode;
                const email = e.student?.email;
                const enrollStatus = e.status?.toLowerCase();
                return (
                  <div
                    key={`${e.classId}-${e.studentId}-${idx}`}
                    onClick={() => setHistoryTarget({ id: e.studentId, name })}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors cursor-pointer"
                    title="View exam history"
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0 text-xs font-bold text-blue-bright">
                      {initials || <FiUser size={14} />}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {code && (
                          <span className="text-[10px] font-mono text-muted">{code}</span>
                        )}
                        {code && email && <span className="text-[10px] text-border">·</span>}
                        {email && (
                          <span className="text-[10px] text-muted truncate">{email}</span>
                        )}
                      </div>
                    </div>
                    {/* Enrollment status */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      enrollStatus === 'enrolled' || enrollStatus === 'active'
                        ? 'text-green bg-green/10 border-green/25'
                        : 'text-muted bg-white/5 border-border'
                    }`}>
                      {e.status ?? 'Enrolled'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted">
            {filtered.length !== enrollments.length
              ? `${filtered.length} of ${enrollments.length} students`
              : `${enrollments.length} students total`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-muted text-xs font-semibold hover:border-blue/40 hover:text-white-soft transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {historyTarget && (
        <StudentExamHistoryModal
          studentId={historyTarget.id}
          studentName={historyTarget.name}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

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
          <StatusBadge status={cls.status} />
        </div>

        <div className="space-y-3 flex-1">
          {[
            { icon: FiClock, text: cls.schedule },
            { icon: FiMapPin, text: `Room ${cls.room}` },
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

export default function ClassManagementPage() {
  const { facultyId } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClassStatus | 'all'>('all');
  const [selectedClass, setSelectedClass] = useState<LecturerClass | null>(null);

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchSchoolAdminClasses({ page: 1, pageSize: 50 });
    return result.items;
  }, []);
  const classes = data ?? [];

  const predicates = useMemo(
    () => [(cls: LecturerClass) => statusFilter === 'all' || cls.status === statusFilter],
    [statusFilter],
  );

  const filteredClasses = useListFilters(classes, search, ['name', 'code'], predicates);

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredClasses.map((cls, i) => (
            <ClassCard key={cls.id} cls={cls} index={i} onViewStudents={setSelectedClass} />
          ))}
        </div>
      )}

      {selectedClass && (
        <StudentListModal cls={selectedClass} onClose={() => setSelectedClass(null)} />
      )}
    </PageShell>
  );
}
