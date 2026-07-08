import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiBriefcase, FiEdit2, FiMail, FiPause, FiPlay,
  FiPlus, FiSearch, FiTrash2, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  CreateInstitutionPayload,
  activateInstitution,
  createInstitution,
  deleteInstitution,
  fetchInstitutions,
  suspendInstitution,
  updateInstitution,
} from '../../../services/adminApi';
import type { ApiInstitution } from '../../../types/api';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === 'active' ? 'text-green bg-green/10 border-green/25' :
    s === 'suspended' ? 'text-red bg-red/10 border-red/25' :
    'text-muted bg-white/5 border-border';
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────

type BillingModel = 'PerUse' | 'Subscription';

interface FormData {
  name: string;
  subDomain: string;
  contactEmail: string;
  billingModel: BillingModel;
}

const EMPTY: FormData = { name: '', subDomain: '', contactEmail: '', billingModel: 'PerUse' };

function InstitutionFormModal({
  target, onClose, onSaved,
}: {
  target: ApiInstitution | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!target;

  useEffect(() => {
    setForm(target ? {
      name: target.name ?? '',
      subDomain: target.subDomain ?? '',
      contactEmail: target.contactEmail ?? '',
      billingModel: (target.billingModel as BillingModel) ?? 'PerUse',
    } : EMPTY);
  }, [target]);

  const set = (k: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.warning('Required', 'Institution name is required.'); return; }
    setSaving(true);
    try {
      const payload: CreateInstitutionPayload = {
        name: form.name.trim(),
        subDomain: form.subDomain.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        billingModel: form.billingModel,
      };
      if (isEdit) {
        await updateInstitution(target.id, payload);
        toast.success('Updated', 'Institution updated.');
      } else {
        await createInstitution(payload);
        toast.success('Created', 'Institution created.');
      }
      onSaved(); onClose();
    } catch (err) {
      console.error('[InstitutionsPage] create/update error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} institution`, msg);
    } finally { setSaving(false); }
  };

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">
            {isEdit ? 'Edit Institution' : 'Create Institution'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Institution Name *</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Hanoi University" className={inp} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Sub Domain</label>
            <input type="text" value={form.subDomain} onChange={set('subDomain')} placeholder="e.g. hanu" className={inp} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Contact Email</label>
            <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="admin@university.edu" className={inp} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Billing Model</label>
            <CustomSelect
              value={form.billingModel}
              onChange={(v) => setForm((f) => ({ ...f, billingModel: v as typeof f.billingModel }))}
              options={[{value:'PerUse',label:'Per Use'},{value:'Subscription',label:'Subscription'}]}
              className="w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function InstitutionsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ApiInstitution | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteInstTarget, setDeleteInstTarget] = useState<ApiInstitution | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => fetchInstitutions({ page: 1, pageSize: 100 }),
    [],
  );
  const institutions: ApiInstitution[] = data?.items ?? [];

  const filtered = search.trim()
    ? institutions.filter((i) =>
        (i.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (i.contactEmail ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : institutions;

  const handleOpenCreate = () => { setEditTarget(null); setShowForm(true); };
  const handleOpenEdit = (inst: ApiInstitution) => { setEditTarget(inst); setShowForm(true); };

  const confirmDeleteInst = async () => {
    if (!deleteInstTarget) return;
    const inst = deleteInstTarget;
    setDeleteInstTarget(null);
    setActionId(inst.id);
    try {
      await deleteInstitution(inst.id);
      toast.success('Deleted', `"${inst.name}" removed.`);
      reload();
    } catch { toast.error('Error', 'Failed to delete institution.'); }
    finally { setActionId(null); }
  };

  const handleToggleStatus = async (inst: ApiInstitution) => {
    setActionId(inst.id);
    try {
      if (inst.status?.toLowerCase() === 'suspended') {
        await activateInstitution(inst.id);
        toast.success('Activated', `"${inst.name}" is now active.`);
      } else {
        await suspendInstitution(inst.id);
        toast.warning('Suspended', `"${inst.name}" has been suspended.`);
      }
      reload();
    } catch { toast.error('Error', 'Failed to update status.'); }
    finally { setActionId(null); }
  };

  const activeCount = institutions.filter((i) => i.status?.toLowerCase() === 'active').length;
  const suspendedCount = institutions.filter((i) => i.status?.toLowerCase() === 'suspended').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Institutions</h1>
          <p className="text-muted text-sm mt-1">Manage all registered universities and institutions on the platform.</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0">
          <FiPlus /> New Institution
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: institutions.length, color: 'text-blue-bright' },
          { label: 'Active', value: activeCount, color: 'text-green' },
          { label: 'Suspended', value: suspendedCount, color: 'text-red' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
        <FiSearch className="text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
        />
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">All Institutions</p>
          <span className="text-xs text-muted">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
                  <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center text-muted text-sm">
            <p className="text-red mb-2">Failed to load institutions.</p>
            <button onClick={reload} className="text-blue-bright underline bg-transparent border-none cursor-pointer text-sm">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <FiBriefcase className="text-4xl mx-auto mb-3 opacity-30" />
            <p className="font-syne font-bold text-white-soft mb-1">No institutions found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((inst) => {
              const isBusy = actionId === inst.id;
              const isSuspended = inst.status?.toLowerCase() === 'suspended';
              return (
                <div key={inst.id} className="flex items-center gap-4 px-5 py-4 hover:bg-navy/40 transition-colors">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-blue-bright shrink-0 font-bold text-sm">
                    {(inst.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{inst.name ?? '—'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted flex-wrap">
                      {inst.contactEmail && (
                        <span className="flex items-center gap-1"><FiMail className="text-[10px]" />{inst.contactEmail}</span>
                      )}
                      {inst.subDomain && <span className="font-mono">.{inst.subDomain}</span>}
                      <span className="bg-navy px-1.5 py-0.5 rounded text-[10px]">{inst.billingModel}</span>
                      <span>Since {fmt(inst.createdAt)}</span>
                    </div>
                  </div>

                  <StatusBadge status={inst.status ?? 'Unknown'} />

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleStatus(inst)}
                      disabled={isBusy}
                      title={isSuspended ? 'Activate' : 'Suspend'}
                      className={`w-8 h-8 rounded-lg border grid place-items-center cursor-pointer transition-all disabled:opacity-40 bg-transparent
                        ${isSuspended ? 'text-green border-green/30 hover:bg-green/10' : 'text-gold border-gold/30 hover:bg-gold/10'}`}
                    >
                      {isSuspended ? <FiPlay className="text-xs" /> : <FiPause className="text-xs" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(inst)}
                      disabled={isBusy}
                      className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue/30 transition-all disabled:opacity-40 bg-transparent"
                    >
                      <FiEdit2 className="text-xs" />
                    </button>
                    <button
                      onClick={() => setDeleteInstTarget(inst)}
                      disabled={isBusy}
                      className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-red hover:border-red/40 transition-all disabled:opacity-40 bg-transparent"
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
        <InstitutionFormModal target={editTarget} onClose={() => setShowForm(false)} onSaved={reload} />
      )}

      {deleteInstTarget && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
          <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div>
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Institution</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold">"{deleteInstTarget.name}"</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteInstTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteInst}
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
