import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiBook, FiCalendar, FiEdit2, FiPlus,
  FiSearch, FiTrash2, FiUser, FiUsers, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  CreateClassPayload,
  createClass,
  createEnrollment,
  deleteClass,
  deleteEnrollment,
  fetchClassEnrollments,
  fetchLecturers,
  fetchSchoolAdminClasses,
  fetchUsers,
  updateClass,
} from '../../../services/schoolAdminApi';
import type { ApiEnrollment, ApiUser } from '../../../types/api';
import type { LecturerClass, LecturerStudent } from '../../../types/lecturer';

// ─── Helpers ─────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'text-green bg-green/10 border-green/25',
    upcoming: 'text-gold bg-gold/10 border-gold/25',
    completed: 'text-muted bg-white/5 border-border',
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${map[status] ?? 'text-muted border-border'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Enrollment Panel ────────────────────────────────────────────────────

function EnrollmentPanel({ cls, institutionId, onClose }: { cls: LecturerClass; institutionId: string; onClose: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ studentId: string; name: string } | null>(null);

  const { data: enrollData, loading, reload } = useAsyncData(
    () => fetchClassEnrollments(cls.id),
    [cls.id],
  );
  const { data: usersData, loading: loadingStudents } = useAsyncData(
    () => fetchUsers({ page: 1, pageSize: 500 }),
    [],
  );

  const enrollments: ApiEnrollment[] = enrollData ?? [];
  // Filter client-side theo institution — backend /api/users chưa scope theo institution
  const allStudents: ApiUser[] = (usersData?.items ?? []).filter(
    (u) => u.role.trim().toLowerCase() === 'student' && (!institutionId || u.institutionId === institutionId),
  );

  // Lọc students chưa enrolled và khớp search
  const enrolledIds = new Set(enrollments.map((e) => e.studentId));
  const suggestions = allStudents.filter((s) => {
    if (enrolledIds.has(s.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.fullName ?? '').toLowerCase().includes(q) ||
      (s.studentCode ?? '').toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }).slice(0, 20);

  const selectedStudent = allStudents.find((s) => s.id === selectedId);

  const handleSelect = (s: ApiUser) => {
    setSelectedId(s.id);
    setSearch(`${s.fullName ?? s.email} (${s.studentCode || s.email})`);
    setShowDropdown(false);
  };

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      await createEnrollment(cls.id, selectedId);
      toast.success('Enrolled', `${selectedStudent?.fullName ?? 'Student'} added to class.`);
      setSelectedId('');
      setSearch('');
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add student.';
      toast.error('Error', msg);
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemovingId(removeTarget.studentId);
    setRemoveTarget(null);
    try {
      await deleteEnrollment(cls.id, removeTarget.studentId);
      toast.success('Removed', 'Student removed from class.');
      reload();
    } catch {
      toast.error('Error', 'Failed to remove student.');
    } finally {
      setRemovingId(null);
    }
  };

  const panel = createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">{cls.code}</p>
            <h2 className="font-syne font-bold text-white-soft text-lg">{cls.name}</h2>
            <p className="text-xs text-muted mt-1">Semester {cls.semester}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>

        {/* Add student — search dropdown */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">Add Student</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, student code, or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSelectedId(''); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full bg-navy border border-border rounded-xl px-4 py-2 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted"
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-navy-card border border-border rounded-xl overflow-y-auto max-h-64 z-50 shadow-xl custom-scrollbar">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => handleSelect(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-navy/60 transition-colors text-left bg-transparent border-none cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 grid place-items-center text-xs font-bold text-blue-bright shrink-0">
                        {(s.fullName ?? s.email ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white-soft font-medium truncate">{s.fullName ?? s.email}</p>
                        <p className="text-[11px] text-muted truncate">{s.studentCode && `${s.studentCode} · `}{s.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-navy-card border border-border rounded-xl px-4 py-3 text-sm text-muted z-50">
                  {loadingStudents
                    ? 'Loading students…'
                    : search.trim()
                    ? `No students found matching "${search}"`
                    : 'No available students to add.'}
                </div>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={!selectedId || adding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-40 transition-colors border-none shrink-0"
            >
              <FiPlus /> {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        {/* Student list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="py-16 text-center">
              <FiUsers className="text-3xl text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">No students enrolled. Add students above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {enrollments.map((e) => {
                // Backend trả student: null → cross-reference với allStudents đã fetch
                const info = allStudents.find((s) => s.id === e.studentId);
                const name = e.student?.fullName ?? info?.fullName ?? e.studentId.slice(0, 8) + '…';
                const code = e.student?.studentCode ?? info?.studentCode ?? '';
                const email = e.student?.email ?? info?.email ?? '';
                const isRemoving = removingId === e.studentId;
                return (
                  <div key={e.studentId} className="flex items-center gap-4 px-6 py-3 hover:bg-navy/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
                      {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                      <p className="text-[11px] text-muted truncate">{code && <span className="font-mono mr-1">{code}</span>}{code && email && '· '}{email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${
                      e.status === 'active' ? 'text-green bg-green/10 border-green/25' : 'text-muted bg-white/5 border-border'
                    }`}>{e.status}</span>
                    <button
                      onClick={() => setRemoveTarget({ studentId: e.studentId, name })}
                      disabled={isRemoving}
                      className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40"
                    >
                      <FiTrash2 className="text-xs" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border shrink-0 text-xs text-muted">
          <strong className="text-white-soft">{enrollments.length}</strong> students enrolled
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {panel}
      {removeTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-300 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Remove Student</h3>
                <p className="text-muted text-sm mt-1">
                  Remove{' '}
                  <span className="text-white-soft font-semibold">{removeTarget.name}</span>{' '}
                  from this class?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Class Form Modal ─────────────────────────────────────────────────────

function todayLocalDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface ClassFormData {
  courseName: string;
  courseCode: string;
  lecturerId: string;
  semester: string;
  academicYear: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: ClassFormData = {
  courseName: '', courseCode: '', lecturerId: '',
  semester: '', academicYear: '', startDate: '', endDate: '',
};

function ClassFormModal({
  editTarget,
  lecturers,
  onClose,
  onSaved,
  institutionId,
}: {
  editTarget: LecturerClass | null;
  lecturers: LecturerStudent[];
  onClose: () => void;
  onSaved: () => void;
  institutionId: string;
}) {
  const toast = useToast();
  const [form, setForm] = useState<ClassFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editTarget;

  useEffect(() => {
    if (editTarget) {
      setForm({
        courseName: editTarget.name,
        courseCode: editTarget.code,
        lecturerId: '',
        semester: editTarget.semester,
        academicYear: '',
        startDate: '',
        endDate: '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editTarget]);

  const set = (k: keyof ClassFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseName.trim()) { toast.warning('Required', 'Course name is required.'); return; }
    if (!form.lecturerId && !isEdit) { toast.warning('Required', 'Please select a lecturer.'); return; }
    // BE (ClassService.ValidateClassFields, thêm 08/08) — validate khớp đúng luật mới:
    if (/^\d/.test(form.courseName.trim())) {
      toast.warning('Invalid', 'Course name cannot start with a number.');
      return;
    }
    if (form.courseCode.trim()) {
      const code = form.courseCode.trim();
      if (/^\d/.test(code)) { toast.warning('Invalid', 'Course code cannot start with a number.'); return; }
      if (!/[A-Za-zÀ-ỹ]/.test(code) || !/\d/.test(code)) {
        toast.warning('Invalid', 'Course code must contain both letters and numbers.');
        return;
      }
    }
    // BE (CreateClassDto) bắt buộc Semester + AcademicYear khi tạo mới — không check trước thì
    // submit fail 400 dù form nhìn như hợp lệ (2 field này trước đây không đánh dấu required).
    if (!isEdit && (!form.semester.trim() || !form.academicYear.trim())) {
      toast.warning('Required', 'Semester and academic year are required.');
      return;
    }
    // Semester giờ KHÔNG được chứa chữ số — năm học phải để riêng ở ô Academic Year (ví dụ
    // Semester "Spring", Academic Year "2024-2025"), không gộp chung như "Spring 2025" nữa.
    if (form.semester.trim() && /\d/.test(form.semester.trim())) {
      toast.warning('Invalid', 'Semester cannot contain numbers — put the year in Academic Year instead (e.g. Semester "Spring", Academic Year "2024-2025").');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.warning('Invalid date', 'End date cannot be before start date.');
      return;
    }
    if (!isEdit && form.startDate && form.startDate < todayLocalDate()) {
      toast.warning('Invalid date', 'Start date cannot be in the past.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateClass(editTarget.id, {
          courseName: form.courseName.trim(),
          courseCode: form.courseCode.trim() || null,
          semester: form.semester.trim() || undefined,
          academicYear: form.academicYear.trim() || undefined,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          ...(form.lecturerId ? { lecturerId: form.lecturerId } : {}),
        });
        toast.success('Updated', 'Class updated successfully.');
      } else {
        const payload: CreateClassPayload = {
          ...(institutionId ? { institutionId } : {}),
          lecturerId: form.lecturerId,
          courseName: form.courseName.trim(),
          courseCode: form.courseCode.trim() || null,
          semester: form.semester.trim(),
          academicYear: form.academicYear.trim(),
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        };
        await createClass(payload);
        toast.success('Created', 'Class created successfully.');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} class`, msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Class' : 'Create New Class'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Course Name *</label>
              <input type="text" value={form.courseName} onChange={set('courseName')} placeholder="e.g. Web Programming" className={inputCls} required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Course Code</label>
              <input type="text" value={form.courseCode} onChange={set('courseCode')} placeholder="e.g. CS201" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Lecturer {!isEdit && '*'}
              </label>
              <CustomSelect
                value={form.lecturerId}
                onChange={(v) => setForm((f) => ({ ...f, lecturerId: v }))}
                options={[
                  {value:'', label: isEdit ? '— Keep current —' : '— Select lecturer —'},
                  ...lecturers.map((l) => ({value:l.id, label:`${l.name} (${l.email})`})),
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Semester{!isEdit && <span className="text-gold ml-1">*</span>} <span className="normal-case font-normal">(no numbers — put the year in Academic Year)</span>
              </label>
              <input type="text" value={form.semester} onChange={set('semester')} placeholder="e.g. Spring" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Academic Year{!isEdit && <span className="text-gold ml-1">*</span>}</label>
              <input type="text" value={form.academicYear} onChange={set('academicYear')} placeholder="e.g. 2024-2025" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
                min={isEdit ? undefined : todayLocalDate()}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">End Date</label>
              <input type="date" value={form.endDate} onChange={set('endDate')} className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Class')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Class Card ───────────────────────────────────────────────────────────

function ClassCard({
  cls,
  onEdit,
  onDelete,
  onManageStudents,
}: {
  cls: LecturerClass;
  onEdit: (cls: LecturerClass) => void;
  onDelete: (cls: LecturerClass) => void;
  onManageStudents: (cls: LecturerClass) => void;
}) {
  return (
    <div className="bg-navy-card border border-border rounded-[20px] p-5 flex flex-col gap-4 hover:border-blue/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[10px] font-mono font-extrabold text-blue-bright bg-blue/10 px-2 py-0.5 rounded mb-2">
            {cls.code}
          </span>
          <h3 className="font-syne font-bold text-white-soft text-base leading-snug truncate">{cls.name}</h3>
          <p className="text-xs text-muted mt-1">Semester {cls.semester}</p>
        </div>
        <StatusBadge status={cls.status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <FiUser className="text-cyan shrink-0" />
          <span className="truncate">{cls.lecturerName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <FiUsers className="text-cyan shrink-0" />
          <span>{cls.studentCount} students</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <FiCalendar className="text-cyan shrink-0" />
          <span>{cls.schedule}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-border/50">
        <button
          onClick={() => onManageStudents(cls)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-blue/30 text-blue-bright text-xs font-semibold cursor-pointer hover:bg-blue/10 transition-colors bg-transparent"
        >
          <FiUsers className="text-sm" /> Students
        </button>
        <button
          onClick={() => onEdit(cls)}
          className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-colors bg-transparent"
        >
          <FiEdit2 className="text-sm" />
        </button>
        <button
          onClick={() => onDelete(cls)}
          className="w-9 h-9 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-colors bg-transparent"
        >
          <FiTrash2 className="text-sm" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

export default function SchoolClassManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LecturerClass | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<LecturerClass | null>(null);
  const [deleteClassTarget, setDeleteClassTarget] = useState<LecturerClass | null>(null);

  const { data: classRes, loading, error, reload } = useAsyncData(
    () => fetchSchoolAdminClasses({ page: 1, pageSize: 100 }),
    [],
  );
  const { data: lecturerRes } = useAsyncData(
    () => fetchLecturers({ page: 1, pageSize: 200, institutionId: user?.institutionId ?? undefined }),
    [user?.institutionId],
  );

  const lecturers: LecturerStudent[] = lecturerRes?.items ?? [];
  const lecturerMap = new Map(lecturers.map((l) => [l.id, l.name]));
  const classes: LecturerClass[] = (classRes?.items ?? []).map((cls) => ({
    ...cls,
    lecturerName: lecturerMap.get(cls.lecturerId) ?? cls.lecturerName,
  }));

  const filtered = search.trim()
    ? classes.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : classes;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  const handleOpenCreate = () => { setEditTarget(null); setShowForm(true); };
  const handleOpenEdit = (cls: LecturerClass) => { setEditTarget(cls); setShowForm(true); };

  const confirmDeleteClass = async () => {
    if (!deleteClassTarget) return;
    const cls = deleteClassTarget;
    setDeleteClassTarget(null);
    try {
      await deleteClass(cls.id);
      toast.success('Deleted', `Class "${cls.name}" removed.`);
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error.';
      toast.error('Failed to delete class', msg);
    }
  };

  const institutionId = user?.institutionId ?? '';

  const activeCount = classes.filter((c) => c.status === 'active').length;
  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Class Management</h1>
          <p className="text-muted text-sm mt-1">Create, edit, and manage classes — assign lecturers and enroll students.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0"
        >
          <FiPlus /> New Class
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Classes', value: classes.length, icon: FiBook, color: 'text-blue-bright' },
          { label: 'Active', value: activeCount, icon: FiCalendar, color: 'text-green' },
          { label: 'Total Students', value: totalStudents, icon: FiUsers, color: 'text-cyan' },
          { label: 'Lecturers Available', value: lecturers.length, icon: FiUsers, color: 'text-gold' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-white/5 grid place-items-center ${k.color}`}>
              <k.icon />
            </div>
            <div>
              <p className={`font-syne font-extrabold text-xl ${k.color}`}>{loading ? '…' : k.value}</p>
              <p className="text-[11px] text-muted">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
        <FiSearch className="text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search by class name or course code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
        />
      </div>

      {/* Class Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-navy-card border border-border rounded-[20px] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-muted">
          <p className="text-red mb-2">Failed to load classes. {error}</p>
          <button onClick={reload} className="text-sm text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <FiBook className="text-4xl mx-auto mb-3 text-muted/40" />
          <p className="font-syne font-bold text-white-soft mb-1">No classes found</p>
          <p className="text-sm">Try a different search or create a new class.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pageItems.map((cls) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                onEdit={handleOpenEdit}
                onDelete={setDeleteClassTarget}
                onManageStudents={setEnrollTarget}
              />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${filtered.length} classes`} />
        </>
      )}

      {/* Modals */}
      {showForm && (
        <ClassFormModal
          editTarget={editTarget}
          lecturers={lecturers}
          institutionId={institutionId}
          onClose={() => setShowForm(false)}
          onSaved={reload}
        />
      )}
      {enrollTarget && (
        <EnrollmentPanel cls={enrollTarget} institutionId={institutionId} onClose={() => setEnrollTarget(null)} />
      )}

      {deleteClassTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Class</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold">"{deleteClassTarget.name}"</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteClassTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClass}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
