import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiBook, FiCalendar, FiEdit2, FiMapPin, FiPlus,
  FiSearch, FiTrash2, FiUsers, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
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
  fetchSchoolAdminStudents,
  updateClass,
} from '../../../services/schoolAdminApi';
import type { ApiEnrollment } from '../../../types/api';
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

function EnrollmentPanel({ cls, onClose }: { cls: LecturerClass; onClose: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: enrollData, loading, reload } = useAsyncData(
    () => fetchClassEnrollments(cls.id),
    [cls.id],
  );
  const { data: studentData } = useAsyncData(
    () => fetchSchoolAdminStudents({ page: 1, pageSize: 200 }),
    [],
  );

  const enrollments: ApiEnrollment[] = enrollData ?? [];
  const allStudents: LecturerStudent[] = studentData?.items ?? [];

  // Lọc students chưa enrolled và khớp search
  const enrolledIds = new Set(enrollments.map((e) => e.studentId));
  const suggestions = allStudents.filter((s) => {
    if (enrolledIds.has(s.id)) return false;
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return (
      (s.name ?? '').toLowerCase().includes(q) ||
      (s.studentId ?? '').toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const selectedStudent = allStudents.find((s) => s.id === selectedId);

  const handleSelect = (s: LecturerStudent) => {
    setSelectedId(s.id);
    setSearch(`${s.name} (${s.studentId || s.email})`);
    setShowDropdown(false);
  };

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      await createEnrollment(cls.id, selectedId);
      toast.success('Enrolled', `${selectedStudent?.name ?? 'Student'} added to class.`);
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

  const handleRemove = async (studentId: string) => {
    if (!window.confirm('Remove this student from the class?')) return;
    setRemovingId(studentId);
    try {
      await deleteEnrollment(cls.id, studentId);
      toast.success('Removed', 'Student removed from class.');
      reload();
    } catch {
      toast.error('Error', 'Failed to remove student.');
    } finally {
      setRemovingId(null);
    }
  };

  return createPortal(
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-navy-card border border-border rounded-xl overflow-hidden z-50 shadow-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => handleSelect(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-navy/60 transition-colors text-left bg-transparent border-none cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue/10 border border-blue/20 grid place-items-center text-xs font-bold text-blue-bright shrink-0">
                        {(s.name ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white-soft font-medium truncate">{s.name}</p>
                        <p className="text-[11px] text-muted truncate">{s.studentId && `${s.studentId} · `}{s.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && search.trim() && suggestions.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-navy-card border border-border rounded-xl px-4 py-3 text-sm text-muted z-50">
                  No students found matching "{search}"
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
        <div className="flex-1 overflow-y-auto">
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
                const name = e.student?.fullName ?? info?.name ?? e.studentId.slice(0, 8) + '…';
                const code = e.student?.studentCode ?? info?.studentId ?? '';
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
                      onClick={() => handleRemove(e.studentId)}
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
}

// ─── Class Form Modal ─────────────────────────────────────────────────────

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
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Semester</label>
              <input type="text" value={form.semester} onChange={set('semester')} placeholder="e.g. Spring 2025" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Academic Year</label>
              <input type="text" value={form.academicYear} onChange={set('academicYear')} placeholder="e.g. 2024-2025" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Start Date</label>
              <input type="date" value={form.startDate} onChange={set('startDate')} className={inputCls} />
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
          <FiMapPin className="text-cyan shrink-0" />
          <span>Room {cls.room}</span>
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

export default function SchoolClassManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LecturerClass | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<LecturerClass | null>(null);

  const { data: classRes, loading, error, reload } = useAsyncData(
    () => fetchSchoolAdminClasses({ page: 1, pageSize: 100 }),
    [],
  );
  const { data: lecturerRes } = useAsyncData(
    () => fetchLecturers({ page: 1, pageSize: 200 }),
    [],
  );

  const classes: LecturerClass[] = classRes?.items ?? [];
  const lecturers: LecturerStudent[] = lecturerRes?.items ?? [];

  const filtered = search.trim()
    ? classes.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : classes;

  const handleOpenCreate = () => { setEditTarget(null); setShowForm(true); };
  const handleOpenEdit = (cls: LecturerClass) => { setEditTarget(cls); setShowForm(true); };

  const handleDelete = async (cls: LecturerClass) => {
    if (!window.confirm(`Delete class "${cls.name}"? This cannot be undone.`)) return;
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
          <p className="text-red mb-2">Failed to load classes.</p>
          <button onClick={reload} className="text-sm text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <FiBook className="text-4xl mx-auto mb-3 text-muted/40" />
          <p className="font-syne font-bold text-white-soft mb-1">No classes found</p>
          <p className="text-sm">Try a different search or create a new class.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
              onManageStudents={setEnrollTarget}
            />
          ))}
        </div>
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
        <EnrollmentPanel cls={enrollTarget} onClose={() => setEnrollTarget(null)} />
      )}
    </div>
  );
}
