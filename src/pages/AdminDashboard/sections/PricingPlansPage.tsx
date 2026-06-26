import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheckCircle, FiDollarSign, FiPlus, FiX } from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  CreatePricingPayload,
  createPricingConfig,
  fetchPricingConfigs,
} from '../../../services/adminApi';
import type { ApiPricingConfig } from '../../../types/api';

type ServiceType = 'Attendance' | 'Proctoring' | 'BiometricRegistration';

const SERVICE_META: Record<ServiceType, { label: string; icon: string; desc: string; color: string }> = {
  Attendance: {
    label: 'Attendance',
    icon: '📋',
    desc: 'Credits deducted per student per attendance session.',
    color: 'text-blue-bright',
  },
  Proctoring: {
    label: 'Exam Proctoring',
    icon: '🎥',
    desc: 'Credits deducted per student per proctored exam.',
    color: 'text-cyan',
  },
  BiometricRegistration: {
    label: 'Biometric Registration',
    icon: '🪪',
    desc: 'Credits deducted per student face registration.',
    color: 'text-gold',
  },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── New Pricing Modal ────────────────────────────────────────────────────

function NewPricingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<CreatePricingPayload>({
    serviceType: 'Attendance',
    unitPrice: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CreatePricingPayload) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: k === 'unitPrice' ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.unitPrice <= 0) { toast.warning('Invalid', 'Unit price must be greater than 0.'); return; }
    setSaving(true);
    try {
      await createPricingConfig(form);
      toast.success('Created', 'New pricing config is now active.');
      onSaved(); onClose();
    } catch {
      toast.error('Error', 'Failed to create pricing config.');
    } finally { setSaving(false); }
  };

  const inp = 'w-full bg-navy border border-border rounded-xl px-3 py-2.5 text-sm text-white-soft outline-none focus:border-blue-bright/50 transition-colors placeholder:text-muted';

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4">
      <div className="bg-navy-card border border-border rounded-[20px] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-syne font-bold text-white-soft text-lg">New Pricing Config</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors">
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Service Type</label>
            <CustomSelect
              value={form.serviceType}
              onChange={(v) => setForm((f) => ({ ...f, serviceType: v as typeof f.serviceType }))}
              options={[
                {value:'Attendance',label:'Attendance'},
                {value:'Proctoring',label:'Proctoring'},
                {value:'BiometricRegistration',label:'Biometric Registration'},
              ]}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Unit Price (Credits per student)</label>
            <input type="number" min={1} value={form.unitPrice || ''} onChange={set('unitPrice')} placeholder="e.g. 50" className={inp} required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Effective Date</label>
            <input type="date" value={form.effectiveDate} onChange={set('effectiveDate')} className={inp} required />
          </div>
          <div className="bg-blue/5 border border-blue/20 rounded-xl p-3 text-xs text-muted">
            ℹ️ Setting a new price will make it the active rate for <strong className="text-white-soft">{form.serviceType}</strong> from the effective date.
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm cursor-pointer hover:border-muted/50 transition-colors bg-transparent">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 disabled:opacity-50 transition-colors border-none">
              {saving ? 'Creating…' : 'Create Config'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PricingPlansPage() {
  const [showModal, setShowModal] = useState(false);

  const { data, loading, error, reload } = useAsyncData(fetchPricingConfigs, []);
  const configs: ApiPricingConfig[] = data ?? [];

  // Group by serviceType, show most recent per type as "active"
  const grouped = configs.reduce<Record<string, ApiPricingConfig[]>>((acc, c) => {
    if (!acc[c.serviceType]) acc[c.serviceType] = [];
    acc[c.serviceType].push(c);
    return acc;
  }, {});

  // Sort each group newest first
  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()),
  );

  const serviceTypes: ServiceType[] = ['Attendance', 'Proctoring', 'BiometricRegistration'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Pricing Plans</h1>
          <p className="text-muted text-sm mt-1">Configure credit costs per service type across all institutions.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue text-white text-sm font-semibold cursor-pointer hover:bg-blue/80 transition-colors border-none shrink-0">
          <FiPlus /> New Pricing
        </button>
      </div>

      {/* Active Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {serviceTypes.map((type) => {
          const meta = SERVICE_META[type];
          const active = grouped[type]?.[0];
          return (
            <div key={type} className="bg-navy-card border border-border rounded-[20px] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wider">Active Rate</p>
                  <p className={`font-syne font-bold text-base ${meta.color}`}>{meta.label}</p>
                </div>
                {active && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-green font-bold bg-green/10 border border-green/25 px-2 py-0.5 rounded-full">
                    <FiCheckCircle className="text-[10px]" /> Active
                  </span>
                )}
              </div>
              {loading ? (
                <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
              ) : active ? (
                <>
                  <div className="flex items-end gap-2">
                    <FiDollarSign className={`text-lg mb-0.5 ${meta.color}`} />
                    <p className={`font-syne font-extrabold text-3xl ${meta.color}`}>{active.unitPrice.toLocaleString()}</p>
                    <p className="text-muted text-sm mb-1">credits / student</p>
                  </div>
                  <p className="text-xs text-muted mt-2">Effective: {fmt(active.effectiveDate)}</p>
                </>
              ) : (
                <p className="text-muted text-sm">No pricing configured yet.</p>
              )}
              <p className="text-[11px] text-muted mt-3 leading-relaxed">{meta.desc}</p>
            </div>
          );
        })}
      </div>

      {/* History Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">Pricing History</p>
          <span className="text-xs text-muted">{configs.length} records</span>
        </div>
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="h-3 bg-white/5 rounded animate-pulse w-1/4" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-1/6 ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-10 text-center text-muted text-sm">
            Failed to load.{' '}
            <button onClick={reload} className="text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
          </div>
        ) : configs.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No pricing configs yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {configs
              .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
              .map((c, idx) => {
                const meta = SERVICE_META[c.serviceType as ServiceType];
                const isLatestOfType = grouped[c.serviceType]?.[0]?.id === c.id;
                return (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-navy/40 transition-colors">
                    <span className="text-lg shrink-0">{meta?.icon ?? '💰'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white-soft">{meta?.label ?? c.serviceType}</p>
                      <p className="text-[11px] text-muted">Effective: {fmt(c.effectiveDate)}</p>
                    </div>
                    <p className={`text-sm font-bold ${meta?.color ?? 'text-white-soft'}`}>
                      {c.unitPrice.toLocaleString()} credits
                    </p>
                    {isLatestOfType && idx === 0 || isLatestOfType ? (
                      <span className="text-[10px] font-bold text-green bg-green/10 border border-green/25 px-2 py-0.5 rounded-full shrink-0">Active</span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted bg-white/5 border border-border px-2 py-0.5 rounded-full shrink-0">Past</span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {showModal && <NewPricingModal onClose={() => setShowModal(false)} onSaved={reload} />}
    </div>
  );
}
