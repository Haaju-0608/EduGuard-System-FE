import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSearch, FiUser } from 'react-icons/fi';
import {
  ClassStatusBadge,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
} from '../../../components/lecturer/LecturerUI';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchClassById, fetchClassEnrollmentsWithStudents } from '../../../services/schoolAdminApi';
import type { LecturerClass } from '../../../types/lecturer';

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** Roster sinh viên của 1 lớp — bấm 1 sinh viên để xem lịch sử bài thi + điểm của người đó
 *  (StudentExamHistoryPage). Vào bằng "View Students" từ ClassManagementPage (kèm state.cls để
 *  khỏi fetch lại), hoặc trực tiếp qua URL (F5 / mở link) thì tự fetch lại bằng fetchClassById. */
export default function ClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');

  const stateCls = (location.state as { cls?: LecturerClass } | null)?.cls ?? null;

  const { data: fetchedCls, loading: loadingCls } = useAsyncData(
    () => (classId && !stateCls ? fetchClassById(classId) : Promise.resolve(null)),
    [classId, stateCls],
  );
  const cls = stateCls ?? fetchedCls;

  const { data: enrollmentsData, loading: loadingRoster, error, reload } = useAsyncData(
    () => (classId ? fetchClassEnrollmentsWithStudents(classId) : Promise.resolve([])),
    [classId],
  );
  const enrollments = enrollmentsData ?? [];

  const filtered = enrollments.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = e.student?.fullName?.toLowerCase() ?? '';
    const email = e.student?.email?.toLowerCase() ?? '';
    const code = e.student?.studentCode?.toLowerCase() ?? '';
    return name.includes(q) || email.includes(q) || code.includes(q);
  });

  const loading = loadingCls || loadingRoster;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Exam Class Management"
        title={cls ? cls.name : loading ? 'Loading…' : 'Class'}
        subtitle="Click a student to view their exam history and scores."
        facultyId={cls?.facultyId}
        actions={
          <PrimaryButton variant="ghost" onClick={() => navigate('/lecture/classes')}>
            <FiArrowLeft /> Back to Classes
          </PrimaryButton>
        }
        stats={cls ? [
          { label: 'Class Code', value: cls.code, icon: '🏷️' },
          { label: 'Status', value: cls.status.charAt(0).toUpperCase() + cls.status.slice(1), icon: '📌' },
          { label: 'Students', value: String(enrollments.length), icon: '👥' },
        ] : undefined}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email or student code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Student Roster</p>
          {cls && <ClassStatusBadge status={cls.status} />}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-navy/40 border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState variant="error" icon="👥" title="Failed to load roster" description={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="👥"
            title={enrollments.length === 0 ? 'No students enrolled yet' : 'No results found'}
            description={enrollments.length === 0 ? 'This class has no enrolled students.' : 'Try a different search.'}
          />
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((e, idx) => {
              const name = e.student?.fullName?.trim() || e.student?.email || 'Unknown';
              const initials = getInitials(name);
              const code = e.student?.studentCode;
              const email = e.student?.email;
              const enrollStatus = e.status?.toLowerCase();
              return (
                <button
                  key={`${e.classId}-${e.studentId}-${idx}`}
                  onClick={() => navigate(`/lecture/classes/${classId}/students/${e.studentId}`, { state: { studentName: name } })}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors cursor-pointer text-left bg-transparent border-none"
                  title="View exam history"
                >
                  <div className="w-9 h-9 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center shrink-0 text-xs font-bold text-blue-bright">
                    {initials || <FiUser size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {code && <span className="text-[10px] font-mono text-muted">{code}</span>}
                      {code && email && <span className="text-[10px] text-border">·</span>}
                      {email && <span className="text-[10px] text-muted truncate">{email}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                    enrollStatus === 'enrolled' || enrollStatus === 'active'
                      ? 'text-green bg-green/10 border-green/25'
                      : 'text-muted bg-white/5 border-border'
                  }`}>
                    {e.status ?? 'Enrolled'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
