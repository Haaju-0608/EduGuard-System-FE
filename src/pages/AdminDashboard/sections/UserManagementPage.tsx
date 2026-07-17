import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUserPlus, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchInstitutions } from '../../../services/adminApi';
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
} from '../../../services/schoolAdminApi';
import type { ApiInstitution, ApiUser } from '../../../types/api';

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
    if (!isEdit && !form.password.trim()) { toast.warning('Required', 'Password is required for new users.'); return; }
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
    } catch {
      toast.error('Error', `Failed to ${isEdit ? 'update' : 'create'} user.`);
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
              <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Nguyen Van A" className={inp} required />
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
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Student / Staff Code</label>
              <input type="text" value={form.studentCode} onChange={set('studentCode')} placeholder="SV001" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+84 9xx xxx xxx" className={inp} />
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
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<ApiUser | null>(null);

  const { data, loading, reload } = useAsyncData(
    () => fetchUsers({ page: 1, pageSize: 200 }),
    [],
  );
  const { data: instData } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 100 }),
    [],
  );
  const users: ApiUser[] = data?.items ?? [];
  const institutions: ApiInstitution[] = instData?.items ?? [];

  const roles = ['all', ...Array.from(new Set(users.map((u) => u.role))).sort()];

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (u.fullName ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.studentCode ?? '').toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

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
        <button onClick={() => { setEditTarget(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0">
          <FiUserPlus /> New User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, color: 'text-blue-bright' },
          { label: 'Students', value: users.filter((u) => u.role?.toLowerCase() === 'student').length, color: 'text-cyan' },
          { label: 'Lecturers', value: users.filter((u) => ['lecturer','instructor'].includes(u.role?.toLowerCase())).length, color: 'text-gold' },
          { label: 'Active', value: users.filter((u) => u.status?.toLowerCase() === 'active').length, color: 'text-green' },
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
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Users</p>
          <span className="text-xs text-muted">{filtered.length} of {users.length}</span>
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
      </div>

      {showForm && <UserFormModal target={editTarget} onClose={() => setShowForm(false)} onSaved={reload} institutions={institutions} />}

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
