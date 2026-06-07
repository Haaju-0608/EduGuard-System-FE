import React, { useMemo, useState } from 'react';
import { FiBookOpen, FiChevronDown, FiMail, FiPhone, FiSearch, FiX } from 'react-icons/fi';
import { ModalOverlay } from '../../../components/lecturer/LecturerAnimations';
import {
  AttendanceProgressBar,
  CourseCodeBadge,
  EmptyState,
  FacultyBadge,
  FilterBar,
  PageHeader,
  PageShell,
  StudentAvatar,
  UniCard,
} from '../../../components/lecturer/LecturerUI';
import { fetchLecturerClasses, fetchLecturerStudents } from '../../../services/lecturerApi';
import type { FacultyId, LecturerStudent, StudentStatus } from '../../../types/lecturer';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useListFilters } from '../../../hooks/useListFilters';
import { useLecturerFaculty } from '../../../hooks/useLecturerFaculty';

/** Badge trạng thái sinh viên */
function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const config = {
    active: { label: 'Active', className: 'text-green bg-green/10 border-green/25' },
    inactive: { label: 'On Leave', className: 'text-red bg-red/10 border-red/25' },
    pending: { label: 'Pending', className: 'text-gold bg-gold/10 border-gold/25' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>
  );
}

/** Modal chi tiết sinh viên — hiển thị thông tin lớp học */
function StudentDetailPanel({ student, onClose }: { student: LecturerStudent; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="uni-card uni-card-accent-blue w-full max-w-[500px] !p-0 overflow-hidden mx-auto">
        {/* Header thẻ sinh viên */}
        <div className="relative bg-linear-to-br from-blue/20 to-cyan/10 p-6 border-b border-border">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-navy/60 border border-border text-muted hover:text-white-soft cursor-pointer grid place-items-center">
            <FiX />
          </button>
          <div className="flex items-center gap-4">
            <StudentAvatar initials={student.initials} size="lg" facultyId={student.facultyId} />
            <div>
              <p className="text-[10px] text-cyan font-bold uppercase tracking-widest mb-1">Student Profile</p>
              <h3 className="font-syne font-extrabold text-xl text-white-soft">{student.name}</h3>
              <p className="text-sm text-muted font-mono mt-0.5">Student ID: {student.studentId}</p>
              <div className="mt-2"><StudentStatusBadge status={student.status} /></div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: FiMail, label: 'Email', value: student.email },
              { icon: FiPhone, label: 'Phone', value: student.phone },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-navy/50 rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 text-[10px] text-muted uppercase tracking-wider mb-1">
                  <Icon className="text-cyan" /> {label}
                </div>
                <p className="text-sm text-white-soft truncate">{value}</p>
              </div>
            ))}
          </div>

          <UniCard facultyId={student.facultyId} hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-3">
              <FiBookOpen className="text-blue-bright" />
              <h4 className="font-syne font-bold text-sm text-white-soft">Course Details</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Course Code</span>
                <CourseCodeBadge code={student.classCode} facultyId={student.facultyId} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Faculty</span>
                <FacultyBadge facultyId={student.facultyId} size="sm" />
              </div>
              <div>
                <span className="text-xs text-muted">Class Name</span>
                <p className="text-sm text-white-soft mt-0.5">{student.className}</p>
              </div>
              <AttendanceProgressBar rate={student.attendanceRate} facultyId={student.facultyId} />
            </div>
          </UniCard>
        </div>
      </div>
    </ModalOverlay>
  );
}

/** Trang quản lý sinh viên */
export default function StudentManagementPage() {
  const { facultyId } = useLecturerFaculty();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState<FacultyId | 'all'>('all');
  const [selectedStudent, setSelectedStudent] = useState<LecturerStudent | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    async () => {
      const [students, classes] = await Promise.all([fetchLecturerStudents(), fetchLecturerClasses()]);
      return { students, classes };
    },
    []
  );

  const students = data?.students ?? [];
  const classes = data?.classes ?? [];

  const predicates = useMemo(
    () => [
      (s: LecturerStudent) => classFilter === 'all' || s.classId === classFilter,
      (s: LecturerStudent) => facultyFilter === 'all' || s.facultyId === facultyFilter,
    ],
    [classFilter, facultyFilter]
  );

  const filteredStudents = useListFilters(students, search, ['name', 'studentId', 'email'], predicates);

  const activeCount = students.filter((s) => s.status === 'active').length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Student Registry"
        title="Student Registry"
        subtitle="List of students by course and faculty. Click on a row to view profile."
        facultyId={facultyId}
        stats={[
          { label: 'Total Students', value: String(students.length), icon: '👥' },
          { label: 'Active', value: String(activeCount), icon: '✅' },
          { label: 'Courses', value: String(classes.length), icon: '📚' },
          { label: 'Semester', value: 'Term 1 25-26', icon: '🗓️' },
        ]}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search by name, student ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="uni-filter-input sm:max-w-[260px] relative">
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All Courses</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 text-muted pointer-events-none" />
        </div>
        <div className="uni-filter-input sm:max-w-[180px] relative">
          <select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value as FacultyId | 'all')}>
            <option value="all">All Faculties</option>
            <option value="it">IT</option>
            <option value="economics">Economics</option>
            <option value="business">Business</option>
            <option value="engineering">Engineering</option>
            <option value="foreign-lang">Languages</option>
          </select>
          <FiChevronDown className="absolute right-3 text-muted pointer-events-none" />
        </div>
      </FilterBar>

      {error ? (
        <EmptyState
          variant="error"
          icon="👥"
          title="Failed to load student list"
          description={error}
          onRetry={reload}
        />
      ) : (
      <div className="uni-table-wrap">
        <div className="overflow-x-auto">
          <table className="uni-table w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student ID</th>
                <th>Course</th>
                <th>Faculty</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6}><div className="uni-skeleton h-12 rounded-xl my-1" /></td>
                    </tr>
                  ))
                : filteredStudents.map((student, i) => (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="animate-stagger-in"
                      style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <StudentAvatar initials={student.initials} size="md" facultyId={student.facultyId} />
                          <div>
                            <p className="font-semibold text-white-soft">{student.name}</p>
                            <p className="text-[11px] text-muted">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="font-mono text-muted text-sm">{student.studentId}</span></td>
                      <td>
                        <CourseCodeBadge code={student.classCode} facultyId={student.facultyId} size="sm" />
                        <p className="text-[11px] text-muted mt-1 max-w-[180px] truncate">{student.className}</p>
                      </td>
                      <td><FacultyBadge facultyId={student.facultyId} size="sm" /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-navy rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${student.attendanceRate >= 80 ? 'bg-green' : 'bg-gold'}`}
                              style={{ width: `${student.attendanceRate}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${student.attendanceRate >= 80 ? 'text-green' : 'text-gold'}`}>
                            {student.attendanceRate}%
                          </span>
                        </div>
                      </td>
                      <td><StudentStatusBadge status={student.status} /></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {!loading && filteredStudents.length === 0 && (
          <EmptyState icon="👥" title="No students found" description="Try changing the filters or search keyword." />
        )}
      </div>
      )}

      {selectedStudent && (
        <StudentDetailPanel student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </PageShell>
  );
}
