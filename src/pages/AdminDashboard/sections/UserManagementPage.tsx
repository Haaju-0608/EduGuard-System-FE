import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiChevronLeft, FiChevronRight, FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUpload, FiUserPlus, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import BulkImportUsersModal from '../../../components/shared/BulkImportUsersModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutions } from '../../../services/adminApi';
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type FetchUsersParams,
} from '../../../services/schoolAdminApi';
import type { ApiInstitution, ApiUser } from '../../../types/api';
import { isValidPhone, MAX_FULLNAME_LENGTH, MAX_PHONE_LENGTH, MAX_STUDENT_CODE_LENGTH } from '../../../utils/formValidation';

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '',          label: 'Newest First' },
  { value: 'fullname',  label: 'Name (A–Z)' },
  { value: '-fullname', label: 'Name (Z–A)' },
  { value: 'email',     label: 'Email (A–Z)' },
  { value: '-email',    label: 'Email (Z–A)' },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RoleBadge({ role }: { role: string }) {
  const r = role?.toLowerCase();
  const cls =
    r.includes('admin') ? 'text-red bg-red/10 border-red/25' :
    r.includes('lecturer') || r.includes('instructor') ? 'text-gold bg-gold/10 border-gold/25' :
    r.includes('school') ? 'text-cyan bg-cyan/10 border-cyan/25' :
    'text-blue-bright bg-blue/10 border-blue/25';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{role}</span>;
}

function StatusDot({ status }: { status: string }) {
  const s = status?.toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${s === 'active' ? 'text-green' : 'text-red'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s === 'active' ? 'bg-green' : 'bg-red'}`} />
      {status}
    </span>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────

interface UserFormData { fullName: string; email: string; password: string; role: string; studentCode: string; phone: string; institutionId: string; }
const EMPTY_USER: UserFormData = { fullName: '', email: '', password: '', role: 'Student', studentCode: '', phone: '', institutionId: '' };

function UserFormModal({
  target, onClose, onSaved, institutions,
}: { target: ApiUser | null; onClose: () => void; onSaved: () => void; institutions: ApiInstitution[] }) {
  const toast = useToast();
  const [form, setForm] = useState<UserFormData>(EMPTY_USER);
  const [saving, setSaving] = useState(false);
  const isEdit = !!target;

  useEffect(() => {
    setForm(target ? {
      fullName: target.fullName ?? '',
      email: target.email ?? '',
      password: '',
      role: target.role ?? 'Student',
      studentCode: target.studentCode ?? '',
      phone: target.phone ?? '',
      institutionId: target.institutionId ?? '',
    } : EMPTY_USER);
  }, [target]);

  const set = (k: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim()) { toast.warning('Required', 'Name and email are required.'); return; }
    if (form.fullName.trim().length > MAX_FULLNAME_LENGTH) { toast.warning('Invalid', `Full name must be at most ${MAX_FULLNAME_LENGTH} characters.`); return; }
    if (!isEdit && !form.password.trim()) { toast.warning('Required', 'Password is required for new users.'); return; }
    if (!isEdit && form.password.trim().length < 6) { toast.warning('Invalid', 'Password must be at least 6 characters.'); return; }
    // BE bắt buộc studentCode khi role = Student (CreateUserDto.Validate() throw nếu thiếu) —
    // FE phải chặn trước, không thì submit fail 400 dù form nhìn như hợp lệ.
    if (form.role === 'Student' && !form.studentCode.trim()) { toast.warning('Required', 'Student code is required for Student accounts.'); return; }
    if (form.studentCode.trim().length > MAX_STUDENT_CODE_LENGTH) { toast.warning('Invalid', `Student/staff code must be at most ${MAX_STUDENT_CODE_LENGTH} characters.`); return; }
    if (form.phone.trim() && !isValidPhone(form.phone)) { toast.warning('Invalid', `Enter a valid phone number (max ${MAX_PHONE_LENGTH} characters).`); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateUser(target.id, {
          fullName: form.fullName.trim(),
          role: form.role,
          phone: form.phone.trim() || undefined,
          studentCode: form.studentCode.trim() || undefined,
          ...(form.institutionId ? { institutionId: form.institutionId } : {}),
        });
        toast.success('Updated', 'User updated successfully.');
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role as 'Student' | 'Lecturer' | 'SchoolAdmin',
          studentCode: form.studentCode.trim() || null,
          phone: form.phone.trim() || null,
          institutionId: form.institutionId || null,
        });
        toast.success('Created', 'User created successfully.');
      }
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} user.`;
      toast.error('Error', msg);
    } finally { setSaving(false); }
  };

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">{isEdit ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors"><FiX /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name *</label>
              <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Nguyen Van A" className={inp} maxLength={MAX_FULLNAME_LENGTH} required />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="user@edu.vn" className={inp} disabled={isEdit} required />
            </div>
            {!isEdit && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Password *</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={inp} required />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Role</label>
              <CustomSelect
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v }))}
                options={[
                  {value:'Student',label:'Student'},
                  {value:'Lecturer',label:'Lecturer'},
                  {value:'SchoolAdmin',label:'School Admin'},
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Student / Staff Code{form.role === 'Student' && <span className="text-gold ml-1">*</span>}
              </label>
              <input type="text" value={form.studentCode} onChange={set('studentCode')} placeholder="SV001" className={inp} maxLength={MAX_STUDENT_CODE_LENGTH} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+84 9xx xxx xxx" className={inp} maxLength={MAX_PHONE_LENGTH} />
            </div>
            {['schooladmin', 'lecturer', 'student'].includes(form.role?.toLowerCase() ?? '') && (
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                  Institution
                  {form.role?.toLowerCase().includes('schooladmin') && <span className="text-gold ml-1">*</span>}
                </label>
                <CustomSelect
                  value={form.institutionId}
                  onChange={(v) => setForm((f) => ({ ...f, institutionId: v }))}
                  options={[{value:'',label:'— Select institution —'}, ...institutions.map((inst) => ({value:inst.id,label:inst.name ?? inst.id}))]}
                  className="w-full"
                />
                {form.role?.toLowerCase().includes('schooladmin') && !form.institutionId && (
                  <p className="text-[10px] text-gold mt-1">School Admin must be linked to an institution to manage classes and students.</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">Cancel</button>
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [institutionFilter, setInstitutionFilter] = useState('all');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<ApiUser | null>(null);

  // Debounce ô search 350ms trước khi gọi BE — gõ liên tục không nên bắn 1 request/ký tự.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Đổi search/sort/filter → luôn quay lại trang 1, tránh đứng ở trang 5 mà kết quả lọc mới chỉ có 2 trang.
  useEffect(() => { setPage(1); }, [debouncedSearch, sort, roleFilter, institutionFilter]);

  // BE (UserRepository.GetAllAsync) chưa hỗ trợ filter theo role/institution qua query param, chỉ có
  // search + sort + pagination thật. Nên khi có filter role/institution, phải tải hết danh sách khớp
  // search (fetchUsers pageSize > 100 tự động gộp nhiều trang) rồi tự phân trang lại ở FE; khi KHÔNG
  // filter gì (trường hợp phổ biến nhất — toàn bộ user) thì dùng phân trang thật từ BE, không tải dư.
  const hasClientFilter = roleFilter !== 'all' || institutionFilter !== 'all';

  const sortParam = (sort || undefined) as FetchUsersParams['sort'];

  const { data, loading, reload } = useAsyncData(
    () => fetchUsers(
      hasClientFilter
        ? { pageSize: 1000, search: debouncedSearch || undefined, sort: sortParam }
        : { page, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, sort: sortParam },
    ),
    [page, debouncedSearch, sort, hasClientFilter],
  );
  const { data: instData } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 100 }),
    [],
  );
  const fetchedUsers: ApiUser[] = data?.items ?? [];
  const institutions: ApiInstitution[] = instData?.items ?? [];
  const institutionNameById = new Map(institutions.map((inst) => [inst.id, inst.name ?? inst.id]));

  // Danh sách cố định (không suy ra từ trang dữ liệu hiện tại nữa — với phân trang thật, trang đang
  // xem có thể chỉ chứa 1-2 role, khiến dropdown "biến mất" role không có mặt trên trang đó). Ẩn
  // SuperAdmin — không phải role có thể tạo/gán qua UI này (chỉ tồn tại do seed sẵn ở BE).
  const roles = ['all', 'Student', 'Lecturer', 'SchoolAdmin'];
  const institutionOptions = [
    { value: 'all', label: 'All Institutions' },
    ...institutions.map((inst) => ({ value: inst.id, label: inst.name ?? inst.id })),
  ];

  const clientFiltered = hasClientFilter
    ? fetchedUsers.filter((u) => {
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        const matchInstitution = institutionFilter === 'all' || u.institutionId === institutionFilter;
        return matchRole && matchInstitution;
      })
    : fetchedUsers;

  const totalItems = hasClientFilter ? clientFiltered.length : (data?.pagination.totalItems ?? fetchedUsers.length);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  // Trang hiện tại có thể vượt quá totalPages mới (vd vừa lọc còn ít kết quả hơn) — kẹp lại để không
  // render 1 trang trống trong lúc effect reset page về 1 chưa kịp chạy.
  const safePage = Math.min(page, totalPages);
  const filtered = hasClientFilter
    ? clientFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : fetchedUsers;

  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const u = deleteUserTarget;
    setDeleteUserTarget(null);
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      toast.success('Deleted', 'User removed.');
      reload();
    } catch { toast.error('Error', 'Failed to delete user.'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">User Management</h1>
          <p className="text-muted text-sm mt-1">All users across the platform — students, lecturers, and admins.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm font-semibold cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent">
            <FiUpload /> Import
          </button>
          <button onClick={() => { setEditTarget(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none">
            <FiUserPlus /> New User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Users', value: totalItems, color: 'text-blue-bright' },
          { label: 'On This Page', value: filtered.length, color: 'text-cyan' },
          { label: 'Page', value: `${safePage} / ${totalPages}`, color: 'text-gold' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input type="text" placeholder="Search name, email, student code..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted" />
        </div>
        <CustomSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={roles.map((r) => ({value:r, label: r === 'all' ? 'All Roles' : r}))}
        />
        <CustomSelect
          value={institutionFilter}
          onChange={setInstitutionFilter}
          options={institutionOptions}
        />
        <CustomSelect
          value={sort}
          onChange={setSort}
          options={SORT_OPTIONS}
        />
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Users</p>
          <span className="text-xs text-muted">{filtered.length} of {totalItems}</span>
        </div>
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-white/5 rounded animate-pulse w-1/3" /><div className="h-2.5 bg-white/5 rounded animate-pulse w-1/4" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No users match your search.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((u) => {
              const initials = (u.fullName ?? u.email).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              const isDeleting = deletingId === u.id;
              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white-soft truncate">{u.fullName ?? '—'}</p>
                      <RoleBadge role={u.role} />
                    </div>
                    <p className="text-[11px] text-muted truncate">{u.email}{u.studentCode && ` · ${u.studentCode}`}</p>
                  </div>
                  <p className="hidden lg:block text-[11px] text-muted shrink-0 max-w-[160px] truncate">
                    {u.institutionId ? (institutionNameById.get(u.institutionId) ?? '—') : '—'}
                  </p>
                  <div className="hidden sm:block shrink-0"><StatusDot status={u.status ?? 'Active'} /></div>
                  <p className="hidden md:block text-[11px] text-muted shrink-0">{fmt(u.createdAt)}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { setEditTarget(u); setShowForm(true); }} className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-all bg-transparent"><FiEdit2 className="text-xs" /></button>
                    <button onClick={() => setDeleteUserTarget(u)} disabled={isDeleting} className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40 bg-transparent"><FiTrash2 className="text-xs" /></button>
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

      {showForm && <UserFormModal target={editTarget} onClose={() => setShowForm(false)} onSaved={reload} institutions={institutions} />}
      {showImport && (
        <BulkImportUsersModal
          onClose={() => setShowImport(false)}
          onImported={reload}
          allowedRoles="Student, Lecturer, or SchoolAdmin"
        />
      )}

      {deleteUserTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete User</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold">"{deleteUserTarget.fullName ?? deleteUserTarget.email}"</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteUserTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
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
