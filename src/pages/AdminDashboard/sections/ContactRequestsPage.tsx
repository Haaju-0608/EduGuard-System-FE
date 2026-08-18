import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiMail, FiMessageSquare, FiPhone, FiSearch, FiUser, FiX,
} from 'react-icons/fi';
import CustomSelect from '../../../components/ui/CustomSelect';
import Pagination from '../../../components/ui/Pagination';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import { fetchContactRequests, updateContactRequestStatus } from '../../../services/adminApi';
import type { ApiContactRequest } from '../../../types/api';

// Khớp đúng string BE cho phép (ContactRequestService.AllowedStatuses) — không phải enum thật,
// chỉ là string tự do, sai chính tả sẽ bị BE từ chối 400.
type ContactStatus = 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED';
const STATUS_ORDER: ContactStatus[] = ['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED'];

const STATUS_CFG: Record<ContactStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'text-gold bg-gold/10 border-gold/25' },
  CONTACTED: { label: 'Contacted', cls: 'text-blue-bright bg-blue/10 border-blue/25' },
  APPROVED:  { label: 'Approved',  cls: 'text-green bg-green/10 border-green/25' },
  REJECTED:  { label: 'Rejected',  cls: 'text-red bg-red/10 border-red/25' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as ContactStatus] ?? { label: status, cls: 'text-muted bg-white/5 border-border' };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Detail modal ───────────────────────────────────────────────────────────

function DetailModal({
  request, onClose, onStatusChanged,
}: {
  request: ApiContactRequest;
  onClose: () => void;
  onStatusChanged: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState<ContactStatus | null>(null);

  const handleSetStatus = async (status: ContactStatus) => {
    if (status === request.status) return;
    setSaving(status);
    try {
      await updateContactRequestStatus(request.id, status);
      toast.success('Updated', `Marked as ${STATUS_CFG[status].label}.`);
      onStatusChanged();
      onClose();
    } catch (err) {
      toast.error('Error', err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSaving(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-200 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-navy-card border border-border rounded-[20px] w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="font-syne font-bold text-white-soft text-lg">{request.schoolName}</h2>
            <p className="text-muted text-xs mt-0.5">Submitted {fmt(request.createdAt)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-transparent border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft transition-colors shrink-0">
            <FiX />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <StatusBadge status={request.status} />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <FiUser className="text-cyan shrink-0" />
              <span className="text-white-soft">{request.contactPersonName}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <FiMail className="text-cyan shrink-0" />
              <span className="text-white-soft break-all">{request.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <FiPhone className="text-cyan shrink-0" />
              <span className="text-white-soft">{request.phoneNumber}</span>
            </div>
          </div>

          {request.message && (
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                <FiMessageSquare /> Message
              </div>
              <div className="bg-navy border border-border rounded-xl p-3 text-sm text-white-soft/90 leading-relaxed whitespace-pre-wrap">
                {request.message}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border shrink-0">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Update Status</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ORDER.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => void handleSetStatus(st)}
                disabled={saving !== null || st === request.status}
                className={`py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-transparent ${STATUS_CFG[st].cls}`}
              >
                {saving === st ? 'Saving…' : STATUS_CFG[st].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function ContactRequestsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ApiContactRequest | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () => fetchContactRequests({ page: 1, pageSize: 200 }),
    [],
  );
  const requests: ApiContactRequest[] = data?.items ?? [];

  // Realtime: BE bắn ResourceChanged/PublishDataChangedAsync(resource="contact-requests") mỗi khi
  // status 1 đơn được cập nhật (kể cả từ tab/máy khác).
  const dashboardHub = useHubConnection(HubRoute.Dashboard, true);
  useHubGroup(HubRoute.Dashboard, 'JoinSystemDashboard', []);
  useHubEvent<{ resource: string }>(dashboardHub, 'ResourceChanged', (payload) => {
    if (payload.resource !== 'contact-requests') return;
    reload();
  });

  const filtered = requests.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || r.schoolName.toLowerCase().includes(q)
      || r.contactPersonName.toLowerCase().includes(q)
      || r.email.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const counts = STATUS_ORDER.reduce((acc, st) => {
    acc[st] = requests.filter((r) => r.status === st).length;
    return acc;
  }, {} as Record<ContactStatus, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">Contact Requests</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: requests.length, color: 'text-blue-bright' },
          { label: 'Pending', value: counts.PENDING, color: 'text-gold' },
          { label: 'Contacted', value: counts.CONTACTED, color: 'text-blue-bright' },
          { label: 'Approved', value: counts.APPROVED, color: 'text-green' },
          { label: 'Rejected', value: counts.REJECTED, color: 'text-red' },
        ].map((k) => (
          <div key={k.label} className="bg-navy-card border border-border rounded-2xl p-4 text-center">
            <p className={`font-syne font-extrabold text-2xl ${k.color}`}>{loading ? '…' : k.value}</p>
            <p className="text-xs text-muted mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-3 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search by school, contact name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'all', label: 'All statuses' },
            ...STATUS_ORDER.map((st) => ({ value: st, label: STATUS_CFG[st].label })),
          ]}
          className="sm:w-56"
        />
      </div>

      {/* Table */}
      <div className="bg-navy-card border border-border rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-bold text-white-soft">All Requests</p>
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
            <p className="text-red mb-2">Failed to load contact requests.</p>
            <button onClick={reload} className="text-blue-bright underline bg-transparent border-none cursor-pointer text-sm">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted">
            <FiMessageSquare className="text-4xl mx-auto mb-3 opacity-30" />
            <p className="font-syne font-bold text-white-soft mb-1">No contact requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pageItems.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-navy/40 transition-colors text-left bg-transparent border-none cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue/10 border border-blue/20 grid place-items-center text-blue-bright shrink-0 font-bold text-sm">
                  {r.schoolName.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white-soft truncate">{r.schoolName}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted flex-wrap">
                    <span className="flex items-center gap-1"><FiUser className="text-[10px]" />{r.contactPersonName}</span>
                    <span className="flex items-center gap-1"><FiMail className="text-[10px]" />{r.email}</span>
                    <span>{fmt(r.createdAt)}</span>
                  </div>
                </div>

                <StatusBadge status={r.status} />
              </button>
            ))}
          </div>
        )}

        {!loading && !error && (
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} className="px-5 py-3.5 border-t border-border" />
        )}
      </div>

      {selected && (
        <DetailModal request={selected} onClose={() => setSelected(null)} onStatusChanged={reload} />
      )}
    </div>
  );
}
