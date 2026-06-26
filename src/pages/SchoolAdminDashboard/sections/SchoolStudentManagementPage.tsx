import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUserPlus, FiX } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { fetchInstitutionById } from '../../../services/adminApi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createUser,
  deleteUser,
  fetchSchoolAdminStudents,
  updateUser,
} from '../../../services/schoolAdminApi';
import type { LecturerStudent } from '../../../types/lecturer';

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === 'active' ? 'text-green bg-green/10 border-green/25' :
    s === 'inactive' || s === 'on leave' ? 'text-red bg-red/10 border-red/25' :
    'text-gold bg-gold/10 border-gold/25';
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>{status}</span>;
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

interface FormData { fullName: string; email: string; password: string; studentCode: string; phone: string; }
const EMPTY: FormData = { fullName: '', email: '', password: '', studentCode: '', phone: '' };

function StudentFormModal({
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
      studentCode: target.studentId ?? '',
      phone: target.phone ?? '',
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
    if (!isEdit && !form.password.trim()) {
      toast.warning('Required', 'Password is required for new students.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateUser(target.id, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          studentCode: form.studentCode.trim() || undefined,
        });
        toast.success('Updated', 'Student updated successfully.');
      } else {
        await createUser({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'student',
          studentCode: form.studentCode.trim() || null,
          phone: form.phone.trim() || null,
          institutionId: institutionId || null,
        });
        toast.success('Created', 'Student account created.');
      }
      onSaved();
      onClose();
    } catch {
      toast.error('Error', `Failed to ${isEdit ? 'update' : 'create'} student.`);
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
            {isEdit ? 'Edit Student' : 'Create Student'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent">
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Full Name *</label>
            <input type="text" value={form.fullName} onChange={set('fullName')} placeholder="Nguyen Van A" className={inp} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="student@edu.vn" className={inp} disabled={isEdit} required />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Password *</label>
              <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={inp} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Student Code</label>
              <input type="text" value={form.studentCode} onChange={set('studentCode')} placeholder="SV001" className={inp} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="0912345678" className={inp} />
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

export default function SchoolStudentManagementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [institutionName, setInstitutionName] = React.useState('');

  React.useEffect(() => {
    if (!user?.institutionId) return;
    fetchInstitutionById(user.institutionId)
      .then((inst) => setInstitutionName(inst.name ?? ''))
      .catch(() => setInstitutionName(''));
  }, [user?.institutionId]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LecturerStudent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, loading, reload } = useAsyncData(
    () => fetchSchoolAdminStudents({ page: 1, pageSize: 200 }),
    [],
  );
  const students: LecturerStudent[] = data?.items ?? [];

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return !q
      || (s.name ?? '').toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q)
      || (s.studentId ?? '').toLowerCase().includes(q);
  });

  const handleDelete = async (s: LecturerStudent) => {
    if (!window.confirm(`Delete student "${s.name ?? s.email}"?`)) return;
    setDeletingId(s.id);
    try {
      await deleteUser(s.id);
      toast.success('Deleted', 'Student account removed.');
      reload();
    } catch {
      toast.error('Error', 'Failed to delete student.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Students</h1>
          <p className="text-muted text-sm mt-1">Manage student accounts for your institution.</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0"
        >
          <FiUserPlus /> New Student
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Students', value: students.length, color: 'text-blue-bright' },
          { label: 'Active', value: students.filter((s) => s.status === 'active').length, color: 'text-green' },
          { label: 'Inactive', value: students.filter((s) => s.status !== 'active').length, color: 'text-red' },
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
            placeholder="Search name, email, student code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Student List</p>
          <span className="text-xs text-muted">{filtered.length} of {students.length}</span>
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
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-muted text-sm">
            {search ? 'No students match your search.' : 'No students yet. Create the first one!'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s) => {
              const initials = (s.name ?? s.email).split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3 hover:bg-navy/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{s.name ?? '—'}</p>
                    <p className="text-[11px] text-muted truncate">
                      {s.studentId && <span className="mr-2 font-mono">{s.studentId}</span>}
                      {s.email}
                    </p>
                  </div>
                  <StatusBadge status={s.status === 'active' ? 'Active' : s.status === 'inactive' ? 'Inactive' : 'Pending'} />
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditTarget(s); setShowForm(true); }}
                      className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-all bg-transparent"
                    >
                      <FiEdit2 className="text-xs" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
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
      </div>

      {showForm && (
        <StudentFormModal
          target={editTarget}
          onClose={() => setShowForm(false)}
          onSaved={reload}
          institutionId={user?.institutionId ?? null}
          institutionName={institutionName}
        />
      )}
    </div>
  );
}
