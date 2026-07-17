import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiClock, FiShield, FiUser, FiX, FiChevronRight, FiImage } from 'react-icons/fi';
import {
  EmptyState,
  FilterPills,
  PageHeader,
  PageShell,
  SkeletonCard,
} from '../../../components/lecturer/LecturerUI';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  approveBiometricRequest,
  fetchSchoolAdminBiometricRequests,
  fetchSignedFaceUrl,
  rejectBiometricRequest,
} from '../../../services/schoolAdminApi';
import type { BiometricRequest, BiometricStatus } from '../../../types/lecturer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentGroup {
  studentId: string;
  studentName: string;
  requests: BiometricRequest[];
  overallStatus: BiometricStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeOverallStatus(reqs: BiometricRequest[]): BiometricStatus {
  if (reqs.some((r) => r.status === 'pending')) return 'pending';
  if (reqs.every((r) => r.status === 'approved')) return 'approved';
  return 'rejected';
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

function StudentCard({
  group,
  previewUrls,
  onClick,
}: {
  group: StudentGroup;
  previewUrls: (string | null | undefined)[];
  onClick: () => void;
}) {
  const pendingCount  = group.requests.filter((r) => r.status === 'pending').length;
  const approvedCount = group.requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = group.requests.filter((r) => r.status === 'rejected').length;
  const firstUrl = previewUrls.find((u) => u) ?? null;

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
        {firstUrl ? (
          <img
            src={firstUrl}
            alt={group.studentName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="bio-face-frame">
            {previewUrls.some((u) => u === undefined) ? (
              <div className="w-10 h-10 rounded-full border-2 border-blue-bright/30 border-t-blue-bright animate-spin" />
            ) : (
              <FiUser className="text-4xl text-blue-bright/50" />
            )}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <BiometricStatusBadge status={group.overallStatus} />
        </div>

        {/* ID Verify badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bio-id-badge">
          <FiShield className="text-[10px]" /> ID Verify
        </div>

        {/* Photo count indicators */}
        <div className="absolute bottom-12 right-3 flex gap-1">
          {group.requests.map((req, i) => (
            <div
              key={req.id}
              title={`Photo ${i + 1}: ${req.status}`}
              className={`w-2 h-2 rounded-full border ${
                req.status === 'approved' ? 'bg-green border-green/50' :
                req.status === 'rejected' ? 'bg-red border-red/50' :
                'bg-gold border-gold/50'
              }`}
            />
          ))}
        </div>

        {/* Name overlay */}
        <div className="absolute bottom-0 inset-x-0 p-4 bio-id-overlay">
          <p className="font-syne font-bold text-white-soft">{group.studentName}</p>
          <p className="text-[11px] text-muted font-mono mt-0.5">Student ID: {group.studentId}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold">
          <FiImage size={11} className="text-muted" />
          <span className="text-muted">{group.requests.length} photo{group.requests.length !== 1 ? 's' : ''}</span>
          {pendingCount > 0  && <span className="text-gold">· {pendingCount} pending</span>}
          {approvedCount > 0 && <span className="text-green">· {approvedCount} approved</span>}
          {rejectedCount > 0 && <span className="text-red">· {rejectedCount} rejected</span>}
        </div>
        <FiChevronRight size={14} className="text-muted group-hover:text-blue-bright transition-colors" />
      </div>
    </div>
  );
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function StudentDetailModal({
  group,
  signedUrls,
  onClose,
  onReview,
  reviewing,
}: {
  group: StudentGroup;
  signedUrls: Record<string, string | null | undefined>;
  onClose: () => void;
  onReview: (id: string, status: 'approved' | 'rejected', reason: string) => Promise<void>;
  reviewing: string | null;
}) {
  const [reason, setReason] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const pendingRequests = group.requests.filter((r) => r.status === 'pending');
  const isReviewing = pendingRequests.some((r) => reviewing === r.id);

  const handleBulkAction = useCallback(async (status: 'approved' | 'rejected') => {
    if (!reason.trim()) {
      toast.warning('Reason required', 'Please enter a reason before reviewing.');
      return;
    }
    for (const req of pendingRequests) {
      await onReview(req.id, status, reason);
    }
    onClose();
  }, [reason, pendingRequests, onReview, toast, onClose]);

  const photoLabels = ['Left', 'Center', 'Right'];

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
              <h2 className="font-syne font-bold text-white-soft">{group.studentName}</h2>
              <p className="text-xs text-muted font-mono">Student ID: {group.studentId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BiometricStatusBadge status={group.overallStatus} />
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
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">
            Submitted Photos ({group.requests.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {group.requests.map((req, idx) => {
              const url = signedUrls[req.id];
              const hasError = imgErrors[req.id];
              const showImg = url && !hasError;

              return (
                <div key={req.id} className="flex flex-col gap-2">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-navy border border-border">
                    {showImg ? (
                      <img
                        src={url}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={() => setImgErrors((prev) => ({ ...prev, [req.id]: true }))}
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

                    {/* Status dot overlay */}
                    <div className="absolute top-2 right-2">
                      <div className={`w-2.5 h-2.5 rounded-full border ${
                        req.status === 'approved' ? 'bg-green border-green/50' :
                        req.status === 'rejected' ? 'bg-red border-red/50' :
                        'bg-gold border-gold/50 animate-pulse'
                      }`} />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] font-bold text-white-soft">
                      {photoLabels[idx] ?? `Photo ${idx + 1}`}
                    </p>
                    <BiometricStatusBadge status={req.status} />
                    {req.note && req.status !== 'pending' && (
                      <p className="text-[9px] text-muted mt-1 leading-tight line-clamp-2">{req.note}</p>
                    )}
                    <p className="text-[9px] text-muted mt-1 flex items-center justify-center gap-1">
                      <FiClock size={8} /> {req.submittedAt}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — only shown if there are pending requests */}
        {pendingRequests.length > 0 && (
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
                onClick={() => void handleBulkAction('approved')}
                disabled={isReviewing}
                className="flex-1 flex items-center justify-center gap-2 bio-btn-approve text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
              >
                <FiCheck />
                Approve All ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => void handleBulkAction('rejected')}
                disabled={isReviewing}
                className="flex-1 flex items-center justify-center gap-2 bio-btn-reject text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
              >
                <FiX />
                Reject All ({pendingRequests.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BiometricApprovalPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<BiometricStatus | 'all'>('all');
  const [reviewing, setReviewing]   = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string | null | undefined>>({});
  const toast = useToast();

  const institutionId = user?.institutionId ?? undefined;

  const { data, loading, error, reload } = useAsyncData(async () => {
    if (!user?.id) return [];
    const result = await fetchSchoolAdminBiometricRequests({ page: 1, pageSize: 50, institutionId });
    return result.items;
  }, [user?.id, institutionId]);

  const requests = data ?? [];

  // Group by studentId → one entry per student
  const allGroups = useMemo<StudentGroup[]>(() => {
    const map = new Map<string, BiometricRequest[]>();
    for (const req of requests) {
      const key = req.studentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(req);
    }
    return Array.from(map.entries()).map(([studentId, reqs]) => ({
      studentId,
      studentName: reqs[0].studentName,
      // Sort by submittedAt so Left/Center/Right order is preserved
      requests: [...reqs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
      overallStatus: computeOverallStatus(reqs),
    }));
  }, [requests]);

  // Filter groups by status
  const filteredGroups = useMemo(() => {
    if (statusFilter === 'all') return allGroups;
    return allGroups.filter((g) => g.overallStatus === statusFilter);
  }, [allGroups, statusFilter]);

  // Counts for filter pills (per student group)
  const counts = useMemo(() => ({
    pending:  allGroups.filter((g) => g.overallStatus === 'pending').length,
    approved: allGroups.filter((g) => g.overallStatus === 'approved').length,
    rejected: allGroups.filter((g) => g.overallStatus === 'rejected').length,
    all:      allGroups.length,
  }), [allGroups]);

  // Fetch signed URLs for all requests in visible groups
  useEffect(() => {
    const allVisible = filteredGroups.flatMap((g) => g.requests);
    const missing = allVisible.filter(
      (r) => r.faceImagePath && !(r.id in signedUrls),
    );
    if (missing.length === 0) return;
    setSignedUrls((prev) => {
      const next = { ...prev };
      missing.forEach((r) => { next[r.id] = undefined; });
      return next;
    });
    missing.forEach(async (r) => {
      const url = await fetchSignedFaceUrl(r.faceImagePath!);
      setSignedUrls((prev) => ({ ...prev, [r.id]: url }));
    });
  }, [filteredGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReview = useCallback(async (
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
        toast.success('Approved', target ? `${target.studentName} — photo verified` : 'Approved.');
      } else {
        await rejectBiometricRequest(requestId, reason);
        toast.success('Rejected', target ? `${target.studentName} — photo rejected` : 'Rejected.');
      }
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to update request.';
      toast.error('Failed to update', msg);
    } finally {
      setReviewing(null);
    }
  }, [requests, toast, reload]);

  // KPI counts (raw request level for stats)
  const rawCounts = useMemo(() => ({
    pending:  requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  }), [requests]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Biometric Verification"
        title="Biometric Verification"
        subtitle="Verify student face photos registered before they join attendance sessions and proctored exams."
        stats={[
          { label: 'Pending',  value: String(rawCounts.pending),  icon: '⏳' },
          { label: 'Approved', value: String(rawCounts.approved), icon: '✅' },
          { label: 'Rejected', value: String(rawCounts.rejected), icon: '❌' },
          { label: 'Total',    value: String(requests.length),    icon: '🔐' },
        ]}
      />

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
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon="🔐"
          title="No requests"
          description="There are no biometric verification requests in this section."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredGroups.map((group, i) => (
            <div key={group.studentId} style={{ animationDelay: `${i * 0.06}s` }} className="animate-stagger-in">
              <StudentCard
                group={group}
                previewUrls={group.requests.map((r) => signedUrls[r.id])}
                onClick={() => setSelectedGroup(group)}
              />
            </div>
          ))}
        </div>
      )}

      {selectedGroup && (
        <StudentDetailModal
          group={selectedGroup}
          signedUrls={signedUrls}
          onClose={() => setSelectedGroup(null)}
          onReview={handleReview}
          reviewing={reviewing}
        />
      )}
    </PageShell>
  );
}
