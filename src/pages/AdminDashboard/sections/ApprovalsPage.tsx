import React, { useState } from 'react';
import { FiCheckCircle, FiClock, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  approveBiometricRequest,
  fetchSchoolAdminBiometricRequests,
  rejectBiometricRequest,
} from '../../../services/schoolAdminApi';
import type { BiometricRequest } from '../../../types/lecturer';

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === 'approved' ? 'text-green bg-green/10 border-green/25' :
    s === 'rejected' ? 'text-red bg-red/10 border-red/25' :
    'text-gold bg-gold/10 border-gold/25';
  const icon = s === 'approved' ? <FiCheckCircle className="text-[10px]" /> : s === 'rejected' ? <FiXCircle className="text-[10px]" /> : <FiClock className="text-[10px]" />;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>
      {icon} {status}
    </span>
  );
}

type TabKey = 'Pending' | 'Approved' | 'Rejected' | 'All';

export default function ApprovalsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('Pending');
  const [actionId, setActionId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => fetchSchoolAdminBiometricRequests({ page: 1, pageSize: 100 }),
    [],
  );
  const requests: BiometricRequest[] = data?.items ?? [];

  const filtered = tab === 'All'
    ? requests
    : requests.filter((r) => r.status?.toLowerCase() === tab.toLowerCase());

  const counts = {
    Pending: requests.filter((r) => r.status?.toLowerCase() === 'pending').length,
    Approved: requests.filter((r) => r.status?.toLowerCase() === 'approved').length,
    Rejected: requests.filter((r) => r.status?.toLowerCase() === 'rejected').length,
    All: requests.length,
  };

  const handleApprove = async (req: BiometricRequest) => {
    const reason = window.prompt('Reason for approval (optional):') ?? '';
    setActionId(req.id);
    try {
      await approveBiometricRequest(req.id, reason);
      toast.success('Approved', 'Biometric request approved.');
      reload();
    } catch { toast.error('Error', 'Failed to approve request.'); }
    finally { setActionId(null); }
  };

  const handleReject = async (req: BiometricRequest) => {
    const reason = window.prompt('Reason for rejection:') ?? '';
    if (!reason.trim()) { toast.warning('Required', 'Please enter a reason for rejection.'); return; }
    setActionId(req.id);
    try {
      await rejectBiometricRequest(req.id, reason);
      toast.warning('Rejected', 'Biometric request rejected.');
      reload();
    } catch { toast.error('Error', 'Failed to reject request.'); }
    finally { setActionId(null); }
  };

  const tabs: TabKey[] = ['Pending', 'Approved', 'Rejected', 'All'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-syne text-2xl font-extrabold text-white-soft">Biometric Approvals</h1>
          <p className="text-muted text-sm mt-1">Review and approve student face registration requests.</p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-muted text-sm cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all bg-transparent disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending', value: counts.Pending, color: 'text-gold', pulse: counts.Pending > 0 },
          { label: 'Approved', value: counts.Approved, color: 'text-green' },
          { label: 'Rejected', value: counts.Rejected, color: 'text-red' },
          { label: 'Total', value: counts.All, color: 'text-blue-bright' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center relative">
            {k.pulse && <span className="absolute top-3 right-3 w-2 h-2 bg-gold rounded-full animate-pulse" />}
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-navy-card border border-border rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-none flex items-center gap-1.5
              ${tab === t ? 'bg-blue text-white' : 'bg-transparent text-muted hover:text-white-soft'}`}
          >
            {t}
            {counts[t] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t ? 'bg-white/20' : 'bg-white/10'}`}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">{tab} Requests</p>
          <span className="text-xs text-muted">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2"><div className="h-3 bg-white/5 rounded animate-pulse w-1/3" /><div className="h-2.5 bg-white/5 rounded animate-pulse w-1/4" /></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center text-muted text-sm">
            <p className="text-red mb-2">Failed to load requests.</p>
            <button onClick={reload} className="text-blue-bright underline bg-transparent border-none cursor-pointer">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <FiCheckCircle className="text-4xl mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {tab.toLowerCase()} requests.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((req) => {
              const name = req.studentName ?? req.studentId?.slice(0, 12) ?? '—';
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              const isPending = req.status?.toLowerCase() === 'pending';
              const isBusy = actionId === req.id;

              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-4 hover:bg-navy/40 transition-colors">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-sm font-bold text-blue-bright shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white-soft truncate">{name}</p>
                    <p className="text-[11px] text-muted truncate">{req.classCode && `${req.classCode} · `}{req.studentId}</p>
                    <p className="text-[11px] text-muted mt-0.5">Submitted: {fmt(req.submittedAt)}</p>
                  </div>

                  <StatusBadge status={req.status ?? 'Pending'} />

                  {/* Actions */}
                  {isPending && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green/10 border border-green/30 text-green text-xs font-semibold cursor-pointer hover:bg-green/20 transition-colors disabled:opacity-40"
                      >
                        <FiCheckCircle className="text-xs" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red/10 border border-red/30 text-red text-xs font-semibold cursor-pointer hover:bg-red/20 transition-colors disabled:opacity-40"
                      >
                        <FiXCircle className="text-xs" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
