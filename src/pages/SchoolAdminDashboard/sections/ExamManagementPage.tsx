import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiCheck, FiChevronDown, FiClock, FiEdit2, FiFileText, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUsers, FiX } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  CreateExamSlotPayload,
  createExamSlot,
  deleteExamSlot,
  fetchExamSlots,
  fetchLecturers,
  fetchSchoolAdminClasses,
  updateExamSlot,
} from '../../../services/schoolAdminApi';
import type { ExamSlot, ExamSlotStatus, LecturerClass, LecturerStudent } from '../../../types/lecturer';

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalDT(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: ExamSlotStatus }) {
  const map: Record<ExamSlotStatus, string> = {
    scheduled: 'text-blue-bright bg-blue/10 border-blue/25',
    ongoing:   'text-green bg-green/10 border-green/25 animate-pulse',
    completed: 'text-muted bg-white/5 border-border',
    cancelled: 'text-red bg-red/10 border-red/25',
  };
  const label: Record<ExamSlotStatus, string> = {
    scheduled: 'Scheduled', ongoing: 'Ongoing', completed: 'Completed', cancelled: 'Cancelled',
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${map[status] ?? 'text-muted border-border'}`}>
      {label[status] ?? status}
    </span>
  );
}

// ─── Proctor Dropdown ─────────────────────────────────────────────────────

function ProctorDropdown({
  lecturers,
  selected,
  onChange,
}: {
  lecturers: LecturerStudent[];
  selected: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = lecturers.filter(
    (l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLecturer = lecturers.find((l) => l.id === selected);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
        Proctor (Giám thị){' '}
        <span className="text-muted font-normal normal-case tracking-normal">— optional</span>
      </label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-navy border border-border rounded-xl px-3 py-2.5 text-sm transition-colors hover:border-blue-bright/40 outline-none"
      >
        {selectedLecturer ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-blue/20 border border-blue/30 grid place-items-center shrink-0 text-[10px] font-bold text-blue-bright">
              {selectedLecturer.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-white-soft truncate">{selectedLecturer.name}</span>
          </div>
        ) : (
          <span className="text-muted">Select a proctor...</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {selected && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(''); }}
              className="text-muted hover:text-white-soft transition-colors cursor-pointer"
            >
              <FiX className="text-xs" />
            </span>
          )}
          <FiChevronDown className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-navy-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <FiSearch className="text-muted text-sm shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search lecturer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No lecturers found</p>
            ) : (
              filtered.map((lec) => {
                const isSelected = lec.id === selected;
                return (
                  <button
                    key={lec.id}
                    type="button"
                    onClick={() => { onChange(isSelected ? '' : lec.id); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/30 last:border-0 ${
                      isSelected ? 'bg-cyan/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue/20 border border-blue/30 grid place-items-center shrink-0 text-[11px] font-bold text-blue-bright">
                      {lec.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white-soft truncate">{lec.name}</p>
                      <p className="text-[11px] text-muted truncate">{lec.email}</p>
                    </div>
                    {isSelected && <FiCheck className="text-cyan shrink-0 text-sm" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────

interface SlotForm {
  classIds: string[];
  classId: string;
  examName: string;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  proctorId: string;
}

const EMPTY_FORM: SlotForm = {
  classIds: [], classId: '', examName: '', startTime: '', endTime: '', durationMinutes: '', proctorId: '',
};

function ExamFormModal({
  target, classes, lecturers, onClose, onSaved,
}: {
  target: ExamSlot | null;
  classes: LecturerClass[];
  lecturers: LecturerStudent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<SlotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!target;

  useEffect(() => {
    setForm(target ? {
      classIds: [],
      classId: target.classId ?? '',
      examName: target.examName,
      startTime: toLocalDT(target.startTime),
      endTime: toLocalDT(target.endTime),
      durationMinutes: target.durationMinutes > 0 ? String(target.durationMinutes) : '',
      proctorId: target.proctorId ?? '',
    } : EMPTY_FORM);
  }, [target]);

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  const toggleClass = (id: string) =>
    setForm((f) => ({
      ...f,
      classIds: f.classIds.includes(id) ? f.classIds.filter((c) => c !== id) : [...f.classIds, id],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.examName.trim() || !form.startTime || !form.endTime) {
      toast.warning('Required', 'Exam name, start and end time are required.');
      return;
    }
    if (new Date(form.endTime) <= new Date(form.startTime)) {
      toast.warning('Invalid', 'End time must be after start time.');
      return;
    }
    if (!isEdit && form.classIds.length === 0) {
      toast.warning('Required', 'Select at least one class.');
      return;
    }
    setSaving(true);
    try {
      const base: Omit<CreateExamSlotPayload, 'classId'> = {
        examName: form.examName.trim(),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        expectedDurationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        proctorId: form.proctorId || undefined,
      };
      if (isEdit) {
        await updateExamSlot(target!.id, { classId: form.classId, ...base });
        toast.success('Updated', 'Exam slot updated.');
      } else {
        await Promise.all(
          form.classIds.map((classId) => createExamSlot({ classId, ...base })),
        );
        toast.success('Created', `${form.classIds.length} exam slot${form.classIds.length > 1 ? 's' : ''} created.`);
      }
      onSaved(); onClose();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save exam slot.');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Exam Slot' : 'New Exam Slot'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors bg-transparent">
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Class selector */}
          {isEdit ? (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Class *</label>
              <CustomSelect
                value={form.classId}
                onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
                options={[{ value: '', label: '— Select class —' }, ...classes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                Classes *{' '}
                <span className="text-muted font-normal normal-case tracking-normal">— select one or more</span>
              </label>
              <div className="bg-navy border border-border rounded-xl max-h-44 overflow-y-auto">
                {classes.length === 0 ? (
                  <p className="text-muted text-sm text-center py-4">No classes available</p>
                ) : (
                  classes.map((c) => {
                    const checked = form.classIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/40 last:border-0 ${
                          checked ? 'bg-blue/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border shrink-0 grid place-items-center transition-colors ${
                          checked ? 'bg-blue border-blue' : 'border-border'
                        }`}>
                          {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </div>
                        <span className="text-[10px] font-bold text-muted font-mono">{c.code}</span>
                        <span className="text-sm text-white-soft truncate">{c.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {form.classIds.length > 0 && (
                <p className="text-xs text-cyan mt-1.5">{form.classIds.length} class{form.classIds.length > 1 ? 'es' : ''} selected</p>
              )}
            </div>
          )}

          {/* Exam Name */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Exam Name *</label>
            <input
              type="text"
              value={form.examName}
              onChange={(e) => setForm((f) => ({ ...f, examName: e.target.value }))}
              placeholder="e.g. Midterm Exam"
              className={inp}
              required
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Start Time *</label>
              <input type="datetime-local" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className={inp} required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">End Time *</label>
              <input type="datetime-local" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className={inp} required />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Duration (minutes)</label>
            <input
              type="number"
              min="1"
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              placeholder="e.g. 90"
              className={inp}
            />
          </div>

          {/* Proctor dropdown */}
          <ProctorDropdown
            lecturers={lecturers}
            selected={form.proctorId}
            onChange={(id) => setForm((f) => ({ ...f, proctorId: id }))}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving
                ? (isEdit ? 'Saving…' : 'Creating…')
                : (isEdit ? 'Save Changes' : `Create${form.classIds.length > 1 ? ` (${form.classIds.length})` : ''}`)}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ExamSlotStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing',   label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ExamManagementPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamSlotStatus | 'all'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ExamSlot | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamSlot | null>(null);

  const { data: slotsData, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchExamSlots({ page: 1, pageSize: 200 });
    return result.items;
  }, []);

  const { data: classesData } = useAsyncData(async () => {
    const result = await fetchSchoolAdminClasses({ page: 1, pageSize: 200 });
    return result.items;
  }, []);

  const { data: lecturersData } = useAsyncData(async () => {
    const result = await fetchLecturers({ page: 1, pageSize: 200 });
    return result.items;
  }, []);

  const classes: LecturerClass[] = classesData ?? [];
  const lecturers: LecturerStudent[] = lecturersData ?? [];
  const myClassIds = new Set(classes.map((c) => c.id));
  const slots: ExamSlot[] = (slotsData ?? []).filter((s) => myClassIds.has(s.classId));

  const filtered = slots.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.examName.toLowerCase().includes(q)
      || s.classCode.toLowerCase().includes(q)
      || s.className.toLowerCase().includes(q);
    return matchSearch && (statusFilter === 'all' || s.status === statusFilter);
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await deleteExamSlot(deleteTarget.id);
      toast.success('Deleted', 'Exam slot removed.');
      reload();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to delete.');
    } finally { setDeletingId(null); }
  };

  const navigate = useNavigate();
  const openCreate = () => { setEditTarget(null); setShowForm(true); };
  const openEdit   = (slot: ExamSlot) => { setEditTarget(slot); setShowForm(true); };

  const kpis = [
    { label: 'Total',     value: slots.length,                                       color: 'text-blue-bright' },
    { label: 'Scheduled', value: slots.filter(s => s.status === 'scheduled').length, color: 'text-gold' },
    { label: 'Ongoing',   value: slots.filter(s => s.status === 'ongoing').length,   color: 'text-green' },
    { label: 'Completed', value: slots.filter(s => s.status === 'completed').length, color: 'text-muted' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Exam Slots</h1>
          <p className="text-muted text-sm mt-1">Create and manage exam sessions for your institution.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0"
        >
          <FiPlus /> New Exam Slot
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-50 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search exam name, course code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as ExamSlotStatus | 'all')}
          options={STATUS_OPTIONS}
        />
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
          <p className="text-sm font-bold text-white-soft">Exam Slot List</p>
          <span className="text-xs text-muted">{filtered.length} of {slots.length}</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-14 text-center space-y-3">
            <p className="text-red text-sm font-semibold">Failed to load exam slots</p>
            <p className="text-muted text-xs">{error}</p>
            <button onClick={reload} className="text-blue-bright text-sm underline cursor-pointer bg-transparent border-none">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-muted text-sm">
            {search || statusFilter !== 'all' ? 'No exam slots match your search.' : 'No exam slots yet. Create the first one!'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((slot) => (
              <div key={slot.id} className="flex items-center gap-4 px-5 py-4 hover:bg-navy/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center shrink-0">
                  <FiUsers className="text-blue-bright" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white-soft truncate">{slot.examName}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy border border-border text-muted font-mono">
                      {slot.classCode}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5">{slot.className}</p>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <FiCalendar className="text-cyan text-[10px]" /> {fmtDT(slot.startTime)}
                    </span>
                    <span className="text-muted text-[11px]">→</span>
                    <span className="text-[11px] text-muted">{fmtDT(slot.endTime)}</span>
                    {slot.durationMinutes > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <FiClock className="text-cyan text-[10px]" /> {slot.durationMinutes} min
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={slot.status} />
                  <button
                    onClick={() => navigate(`/school/exams/${slot.id}/questions`)}
                    className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-cyan/30 text-cyan text-xs font-semibold cursor-pointer hover:bg-cyan/10 transition-all bg-transparent"
                    title="Manage Questions"
                  >
                    <FiFileText className="text-xs" /> Questions
                  </button>
                  <button
                    onClick={() => openEdit(slot)}
                    className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-all bg-transparent"
                    title="Edit"
                  >
                    <FiEdit2 className="text-xs" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(slot)}
                    disabled={deletingId === slot.id}
                    className="w-7 h-7 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40 bg-transparent"
                    title="Delete"
                  >
                    <FiTrash2 className="text-xs" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ExamFormModal
          target={editTarget}
          classes={classes}
          lecturers={lecturers}
          onClose={() => setShowForm(false)}
          onSaved={reload}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Exam Slot</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold">"{deleteTarget.examName}"</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
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
