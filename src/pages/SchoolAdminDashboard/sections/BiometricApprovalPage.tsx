import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiClock, FiSearch, FiShield, FiUser, FiX, FiChevronRight, FiImage, FiTrash2 } from 'react-icons/fi';
import {
  EmptyState,
  FilterBar,
  FilterPills,
  PageHeader,
  PageShell,
  SkeletonCard,
} from '../../../components/lecturer/LecturerUI';
import Pagination from '../../../components/ui/Pagination';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useHubConnection, useHubEvent, useHubGroup } from '../../../hooks/useHubConnection';
import { HubRoute } from '../../../services/realtimeClient';
import {
  approveBiometricRequest,
  deleteBiometricRequest,
  fetchSchoolAdminBiometricRequests,
  fetchSignedFaceUrl,
  rejectBiometricRequest,
} from '../../../services/schoolAdminApi';
import type { BiometricRequest, BiometricStatus } from '../../../types/lecturer';

// 1 request = 1 lần nộp gồm cả 3 ảnh (front/left/right) với 1 status chung cho cả bộ 3 — không
// còn là 3 request riêng biệt như trước, nên không cần group-by-student / tính overallStatus nữa.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve 1 URL ảnh — tự nhận diện URL Supabase đầy đủ (dùng thẳng) vs bare path cũ (ký lại qua
 *  /api/storage/signed-url). undefined = đang ký, null = không có / lỗi. */
function useResolvedFaceUrl(rawUrl: string | null): string | null | undefined {
  const isDirectUrl = !!rawUrl && /^https?:\/\//i.test(rawUrl);
  const [resolved, setResolved] = useState<string | null | undefined>(isDirectUrl ? rawUrl : undefined);

  useEffect(() => {
    if (!rawUrl) { setResolved(null); return; }
    if (/^https?:\/\//i.test(rawUrl)) { setResolved(rawUrl); return; }
    let cancelled = false;
    setResolved(undefined);
    fetchSignedFaceUrl(rawUrl).then((url) => { if (!cancelled) setResolved(url); });
    return () => { cancelled = true; };
  }, [rawUrl]);

  return resolved;
}

function BiometricStatusBadge({ status }: { status: BiometricStatus }) {
  const config = {
    pending:  { label: 'Pending',  cls: 'text-gold bg-gold/10 border-gold/25' },
    approved: { label: 'Approved', cls: 'text-green bg-green/10 border-green/25' },
    rejected: { label: 'Rejected', cls: 'text-red bg-red/10 border-red/25' },
  };
  const { label, cls } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>
  );
}

// ─── Student Card ─────────────────────────────────────────────────────────────

function StudentCard({ request, onClick }: { request: BiometricRequest; onClick: () => void }) {
  const previewRaw = request.frontImageUrl ?? request.leftImageUrl ?? request.rightImageUrl;
  const previewUrl = useResolvedFaceUrl(previewRaw);
  const photoCount = [request.frontImageUrl, request.leftImageUrl, request.rightImageUrl].filter(Boolean).length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="bio-id-card group cursor-pointer"
    >
      {/* Photo preview area */}
      <div className="bio-id-photo">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={request.studentName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="bio-face-frame">
            {previewUrl === undefined ? (
              <div className="w-10 h-10 rounded-full border-2 border-blue-bright/30 border-t-blue-bright animate-spin" />
            ) : (
              <FiUser className="text-4xl text-blue-bright/50" />
            )}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <BiometricStatusBadge status={request.status} />
        </div>

        {/* ID Verify badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bio-id-badge">
          <FiShield className="text-[10px]" /> ID Verify
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 bio-id-overlay">
          <p className="font-syne font-bold text-white-soft">{request.studentName}</p>
          <p className="text-[11px] text-muted font-mono mt-0.5">Student ID: {request.studentId}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <FiImage size={11} className="text-muted" />
          <span className="text-muted">{photoCount} photo{photoCount !== 1 ? 's' : ''}</span>
        </div>
        <FiChevronRight size={14} className="text-muted group-hover:text-blue-bright transition-colors" />
      </div>
    </div>
  );
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function PhotoTile({ label, rawUrl }: { label: string; rawUrl: string | null }) {
  const url = useResolvedFaceUrl(rawUrl);
  const [hasError, setHasError] = useState(false);
  const showImg = url && !hasError;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square rounded-xl overflow-hidden bg-navy border border-border">
        {showImg ? (
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        ) : url === undefined ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-blue-bright/30 border-t-blue-bright animate-spin" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <FiUser size={24} className="text-muted" />
            <p className="text-[9px] text-muted">No image</p>
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-white-soft text-center">{label}</p>
    </div>
  );
}

function StudentDetailModal({
  request,
  onClose,
  onReview,
  reviewing,
  onDeleteRequest,
  deleting,
}: {
  request: BiometricRequest;
  onClose: () => void;
  onReview: (id: string, status: 'approved' | 'rejected', reason: string) => Promise<void>;
  reviewing: string | null;
  onDeleteRequest: (request: BiometricRequest) => void;
  deleting: string | null;
}) {
  const [reason, setReason] = useState('');
  const toast = useToast();

  const isPending = request.status === 'pending';
  const isBusy = reviewing === request.id;

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!reason.trim()) {
      toast.warning('Reason required', 'Please enter a reason before reviewing.');
      return;
    }
    await onReview(request.id, status, reason);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-navy-card border border-border rounded-[20px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue/20 border border-blue/30 flex items-center justify-center">
              <FiUser size={16} className="text-blue-bright" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-white-soft">{request.studentName}</h2>
              <p className="text-xs text-muted font-mono">Student ID: {request.studentId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BiometricStatusBadge status={request.status} />
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-white-soft hover:bg-white/5 transition-colors cursor-pointer"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Photos grid */}
        <div className="overflow-y-auto p-5 custom-scrollbar">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Submitted Photos</p>
          <div className="grid grid-cols-3 gap-3">
            <PhotoTile label="Front" rawUrl={request.frontImageUrl} />
            <PhotoTile label="Left" rawUrl={request.leftImageUrl} />
            <PhotoTile label="Right" rawUrl={request.rightImageUrl} />
          </div>
          {request.note && request.status !== 'pending' && (
            <p className="text-xs text-muted mt-4 leading-relaxed">
              <span className="font-bold text-white-soft/80">Review note: </span>{request.note}
            </p>
          )}
          <p className="text-[10px] text-muted mt-3 flex items-center gap-1">
            <FiClock size={10} /> Submitted {request.submittedAt}
          </p>
        </div>

        {/* Footer — only shown while pending */}
        {isPending && (
          <div className="border-t border-border p-5 shrink-0 space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Review reason (required)..."
              rows={2}
              className="w-full bg-navy/50 border border-border rounded-xl px-3 py-2 text-xs text-white-soft placeholder:text-muted resize-none outline-none focus:border-blue-bright/40 transition-colors"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleAction('approved')}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-2 bio-btn-approve text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
              >
                <FiCheck />
                Approve
              </button>
              <button
                type="button"
                onClick={() => void handleAction('rejected')}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-2 bio-btn-reject text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
              >
                <FiX />
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Delete — always available regardless of status, separate from the pending review actions */}
        <div className="border-t border-border p-3 shrink-0">
          <button
            type="button"
            onClick={() => onDeleteRequest(request)}
            disabled={deleting === request.id}
            className="w-full flex items-center justify-center gap-2 text-[11px] font-semibold text-muted hover:text-red py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50 bg-transparent border-none"
          >
            <FiTrash2 size={12} />
            {deleting === request.id ? 'Deleting…' : 'Delete Request'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;

export default function BiometricApprovalPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<BiometricStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing]   = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<BiometricRequest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BiometricRequest | null>(null);
  const [page, setPage] = useState(1);
  const toast = useToast();

  const institutionId = user?.institutionId ?? undefined;

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user?.id) return [];
    const result = await fetchSchoolAdminBiometricRequests({ page: 1, pageSize: 50, institutionId });
    return result.items;
  }, [user?.id, institutionId]);

  // Realtime: BE bắn ResourceChanged(resource="biometric-requests"/"biometric-data") mỗi khi có yêu
  // cầu đăng ký/re-registration mới hoặc bị duyệt — trước đây phải tự F5 mới thấy request mới.
  const dashboardHub = useHubConnection(HubRoute.Dashboard, !!institutionId);
  useHubGroup(HubRoute.Dashboard, 'JoinInstitutionDashboard', institutionId ? [institutionId] : null);
  useHubEvent<{ resource: string }>(dashboardHub, 'ResourceChanged', (payload) => {
    if (payload.resource !== 'biometric-requests' && payload.resource !== 'biometric-data') return;
    reload();
  });

  const requests = data ?? [];

  // Filter by status + search (student ID, cũng khớp luôn tên cho tiện tra)
  const filteredRequests = useMemo(() => {
    const byStatus = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((r) =>
      r.studentId.toLowerCase().includes(q) || r.studentName.toLowerCase().includes(q),
    );
  }, [requests, statusFilter, search]);

  // Counts for filter pills
  const counts = useMemo(() => ({
    pending:  requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    all:      requests.length,
  }), [requests]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredRequests.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const handleReview = async (
    requestId: string,
    status: 'approved' | 'rejected',
    reason: string,
  ) => {
    if (!reason.trim()) {
      toast.warning('Reason required', 'Please enter a reason before approving or rejecting.');
      return;
    }
    const target = requests.find((r) => r.id === requestId);
    setReviewing(requestId);
    try {
      if (status === 'approved') {
        await approveBiometricRequest(requestId, reason);
        toast.success('Approved', target ? `${target.studentName} — photos verified` : 'Approved.');
      } else {
        await rejectBiometricRequest(requestId, reason);
        toast.success('Rejected', target ? `${target.studentName} — photos rejected` : 'Rejected.');
      }
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to update request.';
      toast.error('Failed to update', msg);
    } finally {
      setReviewing(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setSelectedRequest(null);
    try {
      await deleteBiometricRequest(deleteTarget.id);
      toast.success('Deleted', `${deleteTarget.studentName}'s request has been deleted.`);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error('Failed to delete', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Biometric Verification"
        title="Biometric Verification"
        subtitle="Verify student face photos registered before they join attendance sessions and proctored exams."
        stats={[
          { label: 'Pending',  value: String(counts.pending),  icon: '⏳' },
          { label: 'Approved', value: String(counts.approved), icon: '✅' },
          { label: 'Rejected', value: String(counts.rejected), icon: '❌' },
          { label: 'Total',    value: String(counts.all),      icon: '🔐' },
        ]}
      />

      <FilterBar>
        <div className="uni-filter-input">
          <FiSearch className="text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search by student ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </FilterBar>

      <FilterPills
        tabs={[
          { key: 'pending',  label: 'Pending'  },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all',      label: 'All'      },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
        counts={counts}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="aspect-3/4" />)}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          icon="🔐"
          title="Failed to load biometric requests"
          description={error}
          onRetry={reload}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="🔐"
          title="No requests"
          description="There are no biometric verification requests in this section."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {pageItems.map((request, i) => (
              <div key={request.id} style={{ animationDelay: `${i * 0.06}s` }} className="animate-stagger-in">
                <StudentCard request={request} onClick={() => setSelectedRequest(request)} />
              </div>
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} label={`${filteredRequests.length} requests`} />
        </>
      )}

      {selectedRequest && (
        <StudentDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onReview={handleReview}
          reviewing={reviewing}
          onDeleteRequest={setDeleteTarget}
          deleting={deletingId}
        />
      )}

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-9999 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div
            className="bg-navy-card border border-border rounded-[20px] w-full max-w-sm p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 grid place-items-center shrink-0">
                <FiTrash2 className="text-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-syne font-bold text-white-soft text-base">Delete Biometric Request</h3>
                <p className="text-muted text-sm mt-1">
                  Are you sure you want to delete{' '}
                  <span className="text-white-soft font-semibold break-all">{deleteTarget.studentName}</span>'s
                  biometric request? This action cannot be undone.
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
                onClick={() => void confirmDelete()}
                className="flex-1 py-2.5 rounded-xl bg-red text-white text-sm font-semibold cursor-pointer hover:bg-red/80 transition-colors border-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </PageShell>
  );
}
