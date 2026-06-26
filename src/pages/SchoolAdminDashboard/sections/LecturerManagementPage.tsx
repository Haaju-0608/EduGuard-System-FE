import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  createUser,
  deleteUser,
  fetchLecturers,
  updateUser,
} from '../../../services/schoolAdminApi';
import type { LecturerStudent } from '../../../types/lecturer';

type LecturerStatus = 'Active' | 'Inactive' | 'Suspended';

const statusConfig: Record<LecturerStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: 'bg-green/10', text: 'text-green', border: 'border-green/20' },
  Inactive: { bg: 'bg-muted/10', text: 'text-muted', border: 'border-border/40' },
  Suspended: { bg: 'bg-red/10', text: 'text-red', border: 'border-red/20' },
};

function lecturerStatus(user: LecturerStudent): LecturerStatus {
  const s = (user.status ?? '').toLowerCase();
  if (s === 'suspended') return 'Suspended';
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

export default function LecturerManagementPage() {
  const toast = useToast();
  const { data, loading, reload } = useAsyncData(
    () => fetchLecturers({ page: 1, pageSize: 100 }),
    [],
  );
  const lecturers: LecturerStudent[] = data?.items ?? [];

  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    studentCode: '',
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return lecturers;
    return lecturers.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.studentId.toLowerCase().includes(q),
    );
  }, [lecturers, search]);

  const handleAdd = async () => {
    if (!form.fullName || !form.email || !form.password) return;
    setSubmitting(true);
    try {
      await createUser({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: 'lecturer',
        studentCode: form.studentCode || undefined,
      });
      toast.success('Created', `Lecturer ${form.fullName} has been created.`);
      setForm({ fullName: '', email: '', password: '', studentCode: '' });
      setIsAddOpen(false);
      reload();
    } catch {
      toast.error('Error', 'Failed to create lecturer account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: LecturerStudent) => {
    setActionId(user.id);
    const currentStatus = lecturerStatus(user);
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateUser(user.id, { status: newStatus });
      toast.success('Updated', `Lecturer ${newStatus === 'Suspended' ? 'suspended' : 'activated'}.`);
      reload();
    } catch {
      toast.error('Error', 'Failed to update lecturer status.');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (user: LecturerStudent) => {
    if (!window.confirm(`Delete lecturer "${user.name}"? This cannot be undone.`)) return;
    setActionId(user.id);
    try {
      await deleteUser(user.id);
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne font-extrabold text-[1.6rem] text-white-soft">Lecturers</h1>
          <p className="text-muted text-sm mt-1">{lecturers.length} lecturers in your institution</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold hover:bg-blue/80 transition-colors cursor-pointer border-none"
          >
            <FiPlus /> Add Lecturer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-navy-card border border-border rounded-xl px-3.5 py-2 max-w-sm focus-within:border-blue-bright/40 transition-colors">
        <FiSearch className="text-muted text-sm shrink-0" />
        <input
          type="text"
          placeholder="Search by name, email or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted w-full font-dm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-muted hover:text-white-soft transition-colors bg-transparent border-none cursor-pointer">
            <FiX className="text-xs" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_1.6fr_100px_80px] gap-3 px-5 py-3 border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
          <span>ID / Code</span>
          <span>Name / Email</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.6fr_1fr_120px_80px] gap-3 items-center px-5 py-4">
                {Array.from({ length: 5 }).map((__, j) => (
                  <div key={j} className="h-4 bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <FiUser className="text-3xl text-muted mx-auto mb-3" />
                <p className="text-muted text-sm">No lecturers found</p>
              </div>
            ) : (
              filtered.map((l) => {
                const status = lecturerStatus(l);
                const isActing = actionId === l.id;
                return (
                  <div
                    key={l.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_100px_80px] gap-3 items-center px-5 py-3.5 hover:bg-navy/40 transition-colors"
                  >
                    <span className="text-xs font-mono text-muted">{l.studentId || l.id.slice(0, 10)}</span>
                    <div>
                      <p className="text-sm font-semibold text-white-soft">{l.name}</p>
                      <p className="text-[11px] text-muted">{l.email}</p>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusConfig[status].bg} ${statusConfig[status].text} ${statusConfig[status].border}`}>
                        {status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleStatus(l)}
                        disabled={isActing}
                        title={status === 'Active' ? 'Suspend' : 'Activate'}
                        className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted flex items-center justify-center cursor-pointer hover:text-gold hover:border-gold/40 transition-all disabled:opacity-40"
                      >
                        {status === 'Active' ? <FiXCircle className="text-xs" /> : <FiCheckCircle className="text-xs" />}
                      </button>
                      <button
                        onClick={() => handleDelete(l)}
                        disabled={isActing}
                        title="Delete"
                        className="w-7 h-7 rounded-lg bg-transparent border border-border text-muted flex items-center justify-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40"
                      >
                        <FiTrash2 className="text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Add Modal — portal để tránh bị ảnh hưởng bởi CSS transform của parent */}
      {isAddOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-syne font-bold text-white-soft text-lg">Add Lecturer Account</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors"
              >
                <FiX />
              </button>
            </div>
            <div className="space-y-4">
              {([
                { label: 'Full Name *', field: 'fullName' as const, placeholder: 'e.g. Dr. Nguyen Van A', type: 'text' },
                { label: 'Email *', field: 'email' as const, placeholder: 'nguyenvana@edu.vn', type: 'email' },
                { label: 'Password *', field: 'password' as const, placeholder: 'Min 8 characters', type: 'password' },
                { label: 'Lecturer Code', field: 'studentCode' as const, placeholder: 'e.g. GV301026', type: 'text' },
              ] as const).map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-navy border border-border rounded-xl px-4 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsAddOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.fullName || !form.email || !form.password || submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border-none"
              >
                {submitting ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
