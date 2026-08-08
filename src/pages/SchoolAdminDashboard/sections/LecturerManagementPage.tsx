import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiUserPlus,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import BulkImportUsersModal from '../../../components/shared/BulkImportUsersModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutionById } from '../../../services/adminApi';
import {
  createUser,
  deleteUser,
  fetchLecturers,
  updateUser,
} from '../../../services/schoolAdminApi';
import type { LecturerStudent } from '../../../types/lecturer';
import { isValidPhone, MAX_FULLNAME_LENGTH, MAX_PHONE_LENGTH, MAX_STUDENT_CODE_LENGTH } from '../../../utils/formValidation';

const PAGE_SIZE = 20;

type SortKey = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',   label: 'Newest First' },
  { value: 'oldest',   label: 'Oldest First' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
];

function sortLecturers(list: LecturerStudent[], sort: SortKey): LecturerStudent[] {
  const sorted = [...list];
  switch (sort) {
    case 'oldest': return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'name-asc': return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc': return sorted.sort((a, b) => b.name.localeCompare(a.name));
    default: return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

type LecturerStatus = 'Active' | 'Inactive' | 'Suspended';

const statusConfig: Record<LecturerStatus, string> = {
  Active: 'text-green bg-green/10 border-green/25',
  Inactive: 'text-muted bg-white/5 border-border',
  Suspended: 'text-red bg-red/10 border-red/25',
};

function lecturerStatus(user: LecturerStudent): LecturerStatus {
  const s = (user.status ?? '').toLowerCase();
  if (s === 'suspended') return 'Suspended';
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

function StatusBadge({ status }: { status: LecturerStatus }) {
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusConfig[status]}`}>{status}</span>;
}

// ─── Form Modal (create + edit) ────────────────────────────────────────────

interface FormData { fullName: string; email: string; password: string; staffCode: string; phone: string; }
const EMPTY: FormData = { fullName: '', email: '', password: '', staffCode: '', phone: '' };

function LecturerFormModal({
  target, onClose, onSaved, institutionId, institutionName,
}: { target: LecturerStudent | null; onClose: () => void; onSaved: () => void; institutionId: string | null; institutionName: string }) {
  const toast = useToast();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!target;

  useEffect(() => {
    setForm(target ? {
      fullName: target.name ?? '',
      email: target.email ?? '',
      password: '',
      staffCode: target.studentId && target.studentId !== '—' ? target.studentId : '',
      phone: target.phone && target.phone !== '—' ? target.phone : '',
    } : EMPTY);
  }, [target]);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.warning('Required', 'Name and email are required.');
      return;
    }
    if (form.fullName.trim().length > MAX_FULLNAME_LENGTH) {
      toast.warning('Invalid', `Full name must be at most ${MAX_FULLNAME_LENGTH} characters.`);
      return;
    }
    if (!isEdit && !form.password.trim()) {
      toast.warning('Required', 'Password is required for new lecturers.');
      return;
    }
    if (!isEdit && form.password.trim().length < 6) {
      toast.warning('Invalid', 'Password must be at least 6 characters.');
      return;
    }
    if (form.staffCode.trim().length > MAX_STUDENT_CODE_LENGTH) {
      toast.warning('Invalid', `Staff code must be at most ${MAX_STUDENT_CODE_LENGTH} characters.`);
      return;
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      toast.warning('Invalid', `Enter a valid phone number (max ${MAX_PHONE_LENGTH} characters).`);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateUser(target.id, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          studentCode: form.staffCode.trim() || undefined,
          // role BẮT BUỘC phải gửi: BE (UserService.UpdateUserAsync) ghi đè entity.Role = dto.Role
          // vô điều kiện. Role là enum non-nullable, nếu FE không gửi thì BE deserialize thành
          // default enum value = AppRole.Student (member đầu tiên) — âm thầm hạ role Lecturer
          // xuống Student, biến mất khỏi trang Lecturers dù data không hề mất, chỉ đổi role.
          role: 'Lecturer',
          // BE từ chối update nếu institutionId gửi lên khác institution hiện tại của user
          // (kể cả khi field này bị bỏ trống — null cũng bị coi là "khác") — phải luôn gửi kèm.
          ...(institutionId ? { institutionId } : {}),
        });
        toast.success('Updated', 'Lecturer updated successfully.');
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'Lecturer',
          studentCode: form.staffCode.trim() || undefined,
          phone: form.phone.trim() || null,
          institutionId: institutionId || null,
        });
        toast.success('Created', 'Lecturer account created.');
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} lecturer.`;
      toast.error('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Lecturer' : 'Add Lecturer'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent">
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name *</label>
            <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Dr. Nguyen Van A" className={inp} maxLength={MAX_FULLNAME_LENGTH} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="lecturer@edu.vn" className={inp} disabled={isEdit} required />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Password *</label>
              <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={inp} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Staff Code</label>
              <input type="text" value={form.staffCode} onChange={set('staffCode')} placeholder="GV301026" className={inp} maxLength={MAX_STUDENT_CODE_LENGTH} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="0912345678" className={inp} maxLength={MAX_PHONE_LENGTH} />
            </div>
          </div>
          {institutionName && (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Institution</label>
              <input type="text" value={institutionName} disabled className={`${inp} opacity-60 cursor-not-allowed`} />
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LecturerManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [institutionName, setInstitutionName] = useState('');

  useEffect(() => {
    if (!user?.institutionId) return;
    fetchInstitutionById(user.institutionId)
      .then((inst) => setInstitutionName(inst.name ?? ''))
      .catch(() => setInstitutionName(user.institutionId ?? ''));
  }, [user?.institutionId]);

  // pageSize > 100 — bắt buộc để trigger nhánh tải-hết-các-trang trong fetchPagedOrAll. BE trả về
  // TẤT CẢ role trộn lẫn trong 1 danh sách rồi FE mới lọc role=Lecturer, nên nếu chỉ xin đúng 1 trang
  // (pageSize<=100) như trước, những lecturer nằm sau vị trí 100 trong danh sách gộp (mixed role) sẽ
  // bị bỏ sót âm thầm ở các trường có nhiều user.
  const { data, loading, reload } = useAsyncData(
    () => fetchLecturers({ page: 1, pageSize: 1000, institutionId: user?.institutionId ?? undefined }),
    [user?.institutionId],
  );
  const lecturers: LecturerStudent[] = data?.items ?? [];

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState<LecturerStudent | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteLecturerTarget, setDeleteLecturerTarget] = useState<LecturerStudent | null>(null);

  useEffect(() => { setPage(1); }, [search, sort]);

  const filtered = lecturers.filter((l) => {
    const q = search.toLowerCase();
    return !q
      || (l.name ?? '').toLowerCase().includes(q)
      || l.email.toLowerCase().includes(q)
      || (l.studentId ?? '').toLowerCase().includes(q);
  });

  const sorted = sortLecturers(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleToggleStatus = async (target: LecturerStudent) => {
    setActionId(target.id);
    const currentStatus = lecturerStatus(target);
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateUser(target.id, { status: newStatus });
      toast.success('Updated', `Lecturer ${newStatus === 'Suspended' ? 'suspended' : 'activated'}.`);
      reload();
    } catch {
      toast.error('Error', 'Failed to update lecturer status.');
    } finally {
      setActionId(null);
    }
  };

  const confirmDeleteLecturer = async () => {
    if (!deleteLecturerTarget) return;
    const target = deleteLecturerTarget;
    setDeleteLecturerTarget(null);
    setActionId(target.id);
    try {
      await deleteUser(target.id);
      toast.success('Deleted', 'Lecturer account removed.');
      reload();
    } catch {
      toast.error('Error', 'Failed to delete lecturer.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Lecturers</h1>
          <p className="text-muted text-sm mt-1">Manage lecturer accounts for your institution.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent"
          >
            <FiUpload /> Import
          </button>
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none"
          >
            <FiUserPlus /> Add Lecturer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Lecturers', value: lecturers.length, color: 'text-blue-bright' },
          { label: 'Active', value: lecturers.filter((l) => lecturerStatus(l) === 'Active').length, color: 'text-green' },
          { label: 'Suspended', value: lecturers.filter((l) => lecturerStatus(l) === 'Suspended').length, color: 'text-red' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Refresh */}
      <div className="flex gap-3">
        <div className="flex items-center gap-3 flex-1 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search by name, email or staff code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted hover:text-white-soft transition-colors bg-transparent border-none cursor-pointer shrink-0">
              <FiX className="text-sm" />
            </button>
          )}
        </div>
        <CustomSelect value={sort} onChange={(v) => setSort(v as SortKey)} options={SORT_OPTIONS} />
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* List */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Lecturer List</p>
          <span className="text-xs text-muted">{sorted.length} of {lecturers.length}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-14 text-center text-muted text-sm">
            {search ? 'No lecturers match your search.' : 'No lecturers yet. Add the first one!'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pageItems.map((l) => {
              const status = lecturerStatus(l);
              const isActing = actionId === l.id;
              const initials = (l.name || l.email).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{l.name || '—'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {l.studentId && l.studentId !== '—' && (
                        <span className="text-[10px] font-mono text-cyan bg-cyan/10 border border-cyan/20 px-1.5 py-0.5 rounded-md shrink-0">
                          {l.studentId}
                        </span>
                      )}
                      <span className="text-[11px] text-muted truncate">{l.email}</span>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditTarget(l); setShowForm(true); }}
                      title="Edit"
                      className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-blue-bright hover:border-blue/40 transition-all bg-transparent"
                    >
                      <FiEdit2 className="text-xs" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(l)}
                      disabled={isActing}
                      title={status === 'Active' ? 'Suspend' : 'Activate'}
                      className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-gold hover:border-gold/40 transition-all disabled:opacity-40 bg-transparent"
                    >
                      {status === 'Active' ? <FiXCircle className="text-xs" /> : <FiCheckCircle className="text-xs" />}
                    </button>
                    <button
                      onClick={() => setDeleteLecturerTarget(l)}
                      disabled={isActing}
                      title="Delete"
                      className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40 bg-transparent"
                    >
                      <FiTrash2 className="text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border">
            <p className="text-xs text-muted">Page {safePage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
              >
                <FiChevronLeft />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <LecturerFormModal
          target={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={reload}
          institutionId={user?.institutionId ?? null}
          institutionName={institutionName}
        />
      )}

      {showImport && (
        <BulkImportUsersModal
          onClose={() => setShowImport(false)}
          onImported={reload}
          allowedRoles="Lecturer"
        />
      )}

      {deleteLecturerTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Lecturer</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold">"{deleteLecturerTarget.name}"</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteLecturerTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteLecturer}
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
